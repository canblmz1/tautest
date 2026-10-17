import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewHash, type TestRunner } from '@tautest/core';
import { assertFreshSource, projectFile, readReviewInput } from '../lib/review-input';
import { ensureDir, readJsonFile, writeJsonFile, writeTextFile } from '../lib/fs';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { runEngineProcess, type EngineProcessResult } from '../lib/engine-process';

export interface VerifyOptions { from: string; mutant: string; test: string; file?: string; reportDir?: string; runner?: TestRunner; budget?: string; json?: boolean }
type Executor = (input: Parameters<typeof runEngineProcess>[0]) => Promise<EngineProcessResult>;

export async function runVerifyCommand(cwd: string, options: VerifyOptions, execute: Executor = runEngineProcess): Promise<{ exitCode: number; output: string }> {
  const root = path.resolve(cwd);
  const input = readReviewInput(root, options.from);
  const matches = Object.entries(input.report.files).flatMap(([file, entry]) => entry.mutants
    .filter(m => m.id === options.mutant && (!options.file || file === options.file)).map(m => ({ file, source: entry.source, mutant: m })));
  if (matches.length !== 1) throw new CliError('Select exactly one mutant id. If ids repeat across files, also pass --file.', EXIT_CODES.configError);
  const target = matches[0];
  if (!['Survived', 'NoCoverage'].includes(target.mutant.status)) throw new CliError('Verification requires a Survived or NoCoverage mutant from the original report.', EXIT_CODES.configError);
  assertFreshSource(root, target.file, target.source);
  if (/[:*?!\[\]{}]/.test(target.file)) throw new CliError('This file name cannot be represented safely as a Stryker mutate range.', EXIT_CODES.configError);
  const testFile = path.relative(root, path.resolve(root, options.test)).replace(/\\/g, '/');
  const testPath = projectFile(root, testFile);
  if (!existsSync(testPath) || testFile === target.file) throw new CliError('Select an existing separate test file.', EXIT_CODES.configError);
  const budgetSeconds = Number(options.budget ?? 180);
  if (!/^\d+$/.test(options.budget ?? '180') || !Number.isSafeInteger(budgetSeconds) || budgetSeconds < 1 || budgetSeconds > 86400) {
    throw new CliError('--budget must be a whole number of seconds between 1 and 86400.', EXIT_CODES.configError);
  }
  const testHash = reviewHash(readFileSync(testPath, 'utf8'));
  const base = path.resolve(root, options.reportDir ?? '.tautest/verification');
  ensureDir(base);
  const out = mkdtempSync(path.join(base, 'run-'));
  const request = path.join(out, 'request.json');
  writeJsonFile(request, { root, sourceFile: target.file, source: target.source, testFile, testHash,
    startLine: target.mutant.location.start.line, endLine: target.mutant.location.end.line,
    runner: options.runner, reportRunner: input.report.config?.testRunner, output: out });
  const result = await execute({ root, request, worker: fileURLToPath(new URL('./stryker-worker.js', import.meta.url)),
    log: path.join(out, 'engine.log'), budgetMs: budgetSeconds * 1000 });
  let status: 'verified' | 'not-verified' | 'incomplete' | 'error' = 'error';
  let reason = 'Stryker did not complete its initial test run and mutation run. Inspect engine.log.';
  let killedBy: string[] = [];
  let testsCompleted: number | undefined;
  if (result.budgetExceeded) {
    status = 'incomplete'; reason = 'Execution budget exceeded. No test-fix verification is claimed.';
  } else if (result.exitCode === 0 && existsSync(path.join(out, 'completed.json'))) {
    try {
      assertFreshSource(root, target.file, target.source);
      if (reviewHash(readFileSync(testPath, 'utf8')) !== testHash) throw new Error('Candidate test changed during verification.');
      const completion = readJsonFile<{ initialTestRunPassed: boolean }>(path.join(out, 'completed.json'));
      const verifiedReport = readReviewInput(root, path.join(out, 'mutation.json')).report;
      if (verifiedReport.files[target.file]?.source.replace(/\r\n/g, '\n') !== target.source.replace(/\r\n/g, '\n')) throw new Error('Verification report source differs from the original target.');
      const candidates = verifiedReport.files[target.file]?.mutants.filter(m => m.mutatorName === target.mutant.mutatorName && m.replacement === target.mutant.replacement && JSON.stringify(m.location) === JSON.stringify(target.mutant.location)) ?? [];
      if (candidates.length !== 1) { status = 'incomplete'; reason = 'The exact original mutant was not reproduced; no verification is claimed.'; }
      else {
        const m = candidates[0];
        testsCompleted = m.testsCompleted;
        killedBy = m.killedBy ?? [];
        const testIds = verifiedReport.testFiles?.[testFile]?.tests?.map(t => t.id) ?? [];
        const candidateKilledIt = killedBy.some(id => testIds.includes(id));
        if (completion.initialTestRunPassed === true && m.status === 'Killed' && (m.testsCompleted ?? 0) > 0 && candidateKilledIt) {
          status = 'verified'; reason = 'The original suite passed, and an executed test in the selected candidate file killed the exact target mutant.';
        } else {
          status = 'not-verified'; reason = `Target status: ${m.status}. Verification requires an executed killing test from ${testFile}.`;
        }
      }
    } catch (error) { status = 'incomplete'; reason = error instanceof Error ? error.message : String(error); }
  }
  const evidence = { version: '1', status, reason, createdAt: new Date().toISOString(),
    source: { report: input.path, sha256: input.hash, file: target.file, sourceSha256: reviewHash(target.source) },
    target: { originalId: options.mutant, mutatorName: target.mutant.mutatorName, location: target.mutant.location, replacement: target.mutant.replacement },
    candidate: { file: testFile, sha256: testHash }, testsCompleted, killedBy, execution: result, budgetSeconds,
    paths: { directory: out, evidence: path.join(out, 'verification.json'), log: path.join(out, 'engine.log') } };
  writeJsonFile(path.join(out, 'verification.json'), evidence);
  writeTextFile(path.join(out, 'verification.md'), `# Test-fix verification\n\nStatus: **${status}**\n\n${reason}\n\nCandidate: ${testFile}\nTarget: ${target.file}:${target.mutant.location.start.line} (${target.mutant.mutatorName})\n\nNo production files were edited by Tautest. Stryker ran in its sandbox.\n`);
  return { exitCode: status === 'verified' ? EXIT_CODES.ok : status === 'not-verified' ? EXIT_CODES.thresholdFailed : EXIT_CODES.strykerError,
    output: options.json ? JSON.stringify(evidence, null, 2) + '\n' : `Test-fix verification: ${status}\n${reason}\nEvidence: ${path.join(out, 'verification.json')}\n` };
}
