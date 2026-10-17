import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAnalyzeCommand, runReviewCommand } from '../src/commands/analyze';
import { runVerifyCommand } from '../src/commands/verify';
import { runEngineProcess } from '../src/lib/engine-process';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const source = 'export const discount = age => age >= 65 ? 20 : 0;\n';
const location = { start: { line: 1, column: 32 }, end: { line: 1, column: 41 } };
function raw(status = 'Survived') {
  return { schemaVersion: '2', config: { testRunner: 'vitest' }, files: { 'src/discount.js': { source, mutants: [
    { id: '7', status, mutatorName: 'EqualityOperator', replacement: 'age > 65', testsCompleted: 1, location }
  ] } } };
}
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-review-test-'));
  roots.push(root);
  mkdirSync(path.join(root, 'src'));
  mkdirSync(path.join(root, 'test'));
  writeFileSync(path.join(root, 'src/discount.js'), source);
  writeFileSync(path.join(root, 'test/discount.test.js'), '// candidate test\n');
  writeFileSync(path.join(root, 'mutation.json'), JSON.stringify(raw()));
  return root;
}
function json(root: string, file: string) { return JSON.parse(readFileSync(path.join(root, file), 'utf8')); }
function analyze(root: string) { return JSON.parse(runAnalyzeCommand(root, { from: 'mutation.json', json: true })); }

describe('analyze and manual review', () => {
  it('imports without a package, git or config execution, preserves input and all actionable findings', () => {
    const root = fixture();
    const input = raw();
    input.files['src/discount.js'].mutants.push({ ...input.files['src/discount.js'].mutants[0], id: '8', status: 'NoCoverage' });
    writeFileSync(path.join(root, 'mutation.json'), JSON.stringify(input));
    writeFileSync(path.join(root, 'stryker.config.mjs'), 'throw new Error("CONFIG MUST NOT EXECUTE");');
    const before = readFileSync(path.join(root, 'mutation.json'), 'utf8');
    const result = analyze(root);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].mutants).toHaveLength(2);
    expect(result.rawSummary).toMatchObject({ survived: 1, noCoverage: 1, mutationScore: 0 });
    expect(readFileSync(path.join(root, 'mutation.json'), 'utf8')).toBe(before);
    expect(readFileSync(path.join(root, '.tautest/review/fix-prompt.md'), 'utf8')).toContain('age > 65');
    expect(existsSync(path.join(root, '.tautest/review/report.json'))).toBe(true);
  });

  it('requires a recorded or explicit runner only for prompts and marks pending reports incomplete', () => {
    const root = fixture();
    const input = { files: raw('Pending').files };
    writeFileSync(path.join(root, 'mutation.json'), JSON.stringify(input));
    expect(analyze(root).complete).toBe(false);
    expect(json(root, '.tautest/review/report.json').summary.verdict).toBe('UNKNOWN');
    expect(readFileSync(path.join(root, '.tautest/review/fix-prompt.md'), 'utf8')).toContain('Runner not recorded');
  });

  it('keeps raw scores and findings after review, expires decisions on test or report changes', () => {
    const root = fixture();
    const first = analyze(root);
    runReviewCommand(root, first.groups[0].id, { decision: 'accepted-risk', reason: 'Low impact internal path' });
    expect(analyze(root).groups[0].review.decision).toBe('accepted-risk');
    expect(analyze(root).rawSummary.mutationScore).toBe(0);
    expect(analyze(root).groups[0].mutants).toHaveLength(1);
    writeFileSync(path.join(root, 'test/discount.test.js'), '// changed test\n');
    expect(() => runReviewCommand(root, first.groups[0].id, { decision: 'equivalent', reason: 'stale' })).toThrow('context changed');
    expect(analyze(root).groups[0]).toMatchObject({ review: null, staleReview: true });
    runReviewCommand(root, first.groups[0].id, { decision: 'needs-test', reason: 'Add boundary test' });
    const updated = raw();
    updated.files['src/discount.js'].mutants[0].replacement = 'false';
    writeFileSync(path.join(root, 'mutation.json'), JSON.stringify(updated));
    expect(analyze(root).groups[0]).toMatchObject({ review: null, staleReview: true });
  });

  it('does not reuse reviews with stale source or overwrite the imported report', () => {
    const root = fixture();
    writeFileSync(path.join(root, 'src/discount.js'), 'changed');
    const result = analyze(root);
    expect(result.contextHash).toBeNull();
    expect(() => runReviewCommand(root, result.groups[0].id, { decision: 'equivalent', reason: 'reason' })).toThrow('context changed');
    writeFileSync(path.join(root, 'report.json'), JSON.stringify(raw()));
    expect(() => runAnalyzeCommand(root, { from: 'report.json', reportDir: '.' })).toThrow('input report');
  });

  it('protects hardlinked input and preserves an explicit prompt runner across reviews in the project root', () => {
    const root = fixture();
    const input = { files: raw().files };
    writeFileSync(path.join(root, 'mutation.json'), JSON.stringify(input));
    linkSync(path.join(root, 'mutation.json'), path.join(root, 'report.json'));
    expect(() => runAnalyzeCommand(root, { from: 'mutation.json', reportDir: '.' })).toThrow('input report');
    rmSync(path.join(root, 'report.json'));
    const result = JSON.parse(runAnalyzeCommand(root, { from: 'mutation.json', reportDir: '.', runner: 'jest', json: true }));
    runReviewCommand(root, result.groups[0].id, { reportDir: '.', decision: 'needs-test', reason: 'Boundary needed' });
    expect(readFileSync(path.join(root, 'fix-prompt.md'), 'utf8')).toContain('existing jest test style');
  });
});

type VerifyExecutor = NonNullable<Parameters<typeof runVerifyCommand>[2]>;
function engine(options: { status?: string; killedBy?: readonly string[]; testsCompleted?: number; completion?: boolean; source?: string; replacement?: string } = {}): VerifyExecutor {
  return vi.fn(async request => {
    const destination = JSON.parse(readFileSync(request.request, 'utf8')).output;
    const report = raw(options.status ?? 'Killed');
    report.files['src/discount.js'].source = options.source ?? source;
    const mutant = report.files['src/discount.js'].mutants[0];
    Object.assign(mutant, { id: '99', killedBy: options.killedBy ?? ['candidate-0'], testsCompleted: options.testsCompleted ?? 2, replacement: options.replacement ?? mutant.replacement });
    writeFileSync(path.join(destination, 'mutation.json'), JSON.stringify({ ...report, testFiles: {
      'test/discount.test.js': { tests: [{ id: 'candidate-0', name: 'boundary' }] },
      'test/other.test.js': { tests: [{ id: 'other-0', name: 'other' }] }
    } }));
    if (options.completion !== false) writeFileSync(path.join(destination, 'completed.json'), '{"initialTestRunPassed":true}');
    return { exitCode: 0, budgetExceeded: false };
  });
}
const verifyOptions = { from: 'mutation.json', mutant: '7', test: 'test/discount.test.js', json: true };
describe('exact mutant verification', () => {
  it('uses mutant identity across renumbered reports and records the executed candidate kill', async () => {
    const root = fixture();
    const execute = engine();
    const before = readFileSync(path.join(root, 'src/discount.js'), 'utf8');
    const result = await runVerifyCommand(root, verifyOptions, execute);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({ status: 'verified', killedBy: ['candidate-0'], testsCompleted: 2, target: { originalId: '7' } });
    expect(readFileSync(path.join(root, 'src/discount.js'), 'utf8')).toBe(before);
  });

  it.each([
    [{ status: 'Survived', killedBy: [] }, 'not-verified'],
    [{ status: 'Timeout' }, 'not-verified'],
    [{ killedBy: ['other-0'] }, 'not-verified'],
    [{ testsCompleted: 0 }, 'not-verified'],
    [{ completion: false }, 'error'],
    [{ replacement: 'false' }, 'incomplete'],
    [{ source: source + '// different' }, 'incomplete']
  ] as const)('does not claim a fix for %j', async (options, status) => {
    const result = await runVerifyCommand(fixture(), verifyOptions, engine(options));
    expect(result.exitCode).not.toBe(0);
    expect(JSON.parse(result.output).status).toBe(status);
  });

  it('refuses stale source, escaping candidate paths and invalid budgets before engine execution', async () => {
    const root = fixture();
    const execute = engine();
    await expect(runVerifyCommand(root, { ...verifyOptions, budget: 'NaN' }, execute)).rejects.toThrow('--budget');
    await expect(runVerifyCommand(root, { ...verifyOptions, test: '../outside.js' }, execute)).rejects.toThrow('relative');
    writeFileSync(path.join(root, 'src/discount.js'), 'stale source');
    await expect(runVerifyCommand(root, verifyOptions, execute)).rejects.toThrow('Source changed');
    expect(execute).not.toHaveBeenCalled();
  });

  it('records budget exhaustion as incomplete even when an executor returns zero', async () => {
    const result = await runVerifyCommand(fixture(), verifyOptions, async () => ({ exitCode: 0, budgetExceeded: true }));
    expect(result.exitCode).toBe(12);
    expect(JSON.parse(result.output).status).toBe('incomplete');
  });
});

describe('worker execution budget', () => {
  it('terminates the process tree before returning an incomplete result', async () => {
    const root = fixture();
    const worker = path.join(root, 'worker.cjs');
    const heartbeat = path.join(root, 'heartbeat');
    writeFileSync(worker, `const {spawn}=require('node:child_process'); const {writeFileSync}=require('node:fs');
      spawn(process.execPath, ['-e', ${JSON.stringify(`setInterval(()=>require('node:fs').writeFileSync(${JSON.stringify(heartbeat)}, String(Date.now())), 30)`)}], {stdio:'ignore', windowsHide:true});
      setInterval(()=>{}, 100);`);
    const started = Date.now();
    const result = await runEngineProcess({ root, worker, request: 'unused', log: path.join(root, 'worker.log'), budgetMs: 3000 });
    expect(result.budgetExceeded).toBe(true);
    expect(result.error).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(15000);
    const last = readFileSync(heartbeat, 'utf8');
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(readFileSync(heartbeat, 'utf8')).toBe(last);
  }, 20000);
});
