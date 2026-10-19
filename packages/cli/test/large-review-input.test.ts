import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readLargeReviewReport } from '../src/lib/large-review-input';
import { readReviewInput } from '../src/lib/review-input';
import { runAnalyzeCommand, runReviewCommand } from '../src/commands/analyze';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(text: string) {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-stream-test-'));
  roots.push(root);
  const file = path.join(root, 'mutation.json');
  writeFileSync(file, text);
  return { root, file };
}

it('omits only direct mutant diagnostic strings, preserving every other value and the original hash', async () => {
  const reason = 'diagnostic \\"\nTürkçe 😀'.repeat(20000);
  const input = { statusReason: 'root diagnostic', files: {
    'src/a.mutants.0.statusReason.ts': { source: 'const x = 1;', statusReason: 'file diagnostic', mutants: [
      { id: '1', status: 'Survived', replacement: '2', coveredBy: ['t'], statusReason: reason, other: { statusReason: 'nested' } },
      { id: '2', status: 'Killed', killedBy: ['t'], statusReason: 'short' },
      { id: '3', status: 'Ignored', statusReason: { detail: 'non-string preserved' } }
    ] }
  }, testFiles: { 'test/a.ts': { tests: [{ id: 't', name: 'boundary 😀' }] } },
  unicode: '😀'.repeat(40000) + '\ud800\udfff',
  metadata: JSON.parse('{"__proto__":{"polluted":true},"constructor":"preserved","n":1.234e-50}') };
  const text = JSON.stringify(input);
  const { file } = fixture(text);
  const result = await readLargeReviewReport(file);
  const expected = JSON.parse(text);
  delete expected.files['src/a.mutants.0.statusReason.ts'].mutants[0].statusReason;
  delete expected.files['src/a.mutants.0.statusReason.ts'].mutants[1].statusReason;
  expect(result.value).toEqual(expected);
  expect(Object.getPrototypeOf(result.value.metadata)).toBe(Object.prototype);
  expect(result.hash).toBe(createHash('sha256').update(text).digest('hex'));
  expect(result.importDetails).toMatchObject({ mode: 'streamed', inputBytes: Buffer.byteLength(text), omittedStatusReasons: 2 });
  expect(readFileSync(file, 'utf8')).toBe(text);
});

it('rejects retained data overflow, raw input overflow and malformed or trailing JSON', async () => {
  const { file } = fixture('{"source":"' + 'x'.repeat(200000) + '"}');
  await expect(readLargeReviewReport(file, { input: 300000, retained: 1000 })).rejects.toThrow('after omitting');
  await expect(readLargeReviewReport(file, { input: 1000, retained: 300000 })).rejects.toThrow('import limit');
  for (const text of ['{"files":{"x":{"mutants":[{"statusReason":"bad\\x"}]}}}', '{"files":{}', '{} {}']) {
    writeFileSync(file, text);
    await expect(readLargeReviewReport(file)).rejects.toThrow();
  }
  writeFileSync(file, '{"' + 'x'.repeat(1024 * 1024 + 1) + '":0}');
  await expect(readLargeReviewReport(file)).rejects.toThrow('property name');
  writeFileSync(file, '['.repeat(1030) + '0' + ']'.repeat(1030));
  await expect(readLargeReviewReport(file)).rejects.toThrow('maxDepth');
});

it('automatically imports a report above the old limit, retaining validation and zero-test safeguards', async () => {
  // Whitespace creates a >128 MiB report without allocating one enormous JSON string.
  const { root, file } = fixture('');
  const descriptor = openSync(file, 'w');
  try {
    const padding = Buffer.alloc(64 * 1024, ' ');
    for (let i = 0; i < 2048; i++) writeSync(descriptor, padding);
    writeSync(descriptor, JSON.stringify({ files: { 'a.js': {
    source: 'x', mutants: [{ id: '1', status: 'Survived', mutatorName: 'StringLiteral', replacement: 'y', testsCompleted: 1,
      location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } }, statusReason: 'diagnostic' }]
    } } }));
  } finally { closeSync(descriptor); }
  const result = await readReviewInput(root, file);
  expect(result.importDetails?.omittedStatusReasons).toBe(1);
  expect(result.report.files['a.js'].mutants[0].status).toBe('Survived');
  writeFileSync(path.join(root, 'a.js'), 'x');
  const review = JSON.parse(await runAnalyzeCommand(root, { from: file, json: true }));
  expect(review.contextHash).toEqual(expect.any(String));
  expect(review.input.sha256).toBe(result.hash);
  expect(readFileSync(path.join(root, '.tautest/review/report.md'), 'utf8')).toContain('omitted 1 mutant statusReason');
  // Change only the omitted diagnostic: it must still invalidate recorded context.
  const update = openSync(file, 'r+');
  try {
    const original = JSON.stringify({ files: { 'a.js': {
      source: 'x', mutants: [{ id: '1', status: 'Survived', mutatorName: 'StringLiteral', replacement: 'y', testsCompleted: 1,
        location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } }, statusReason: 'diagnostic' }]
    } } });
    writeSync(update, original.replace('diagnostic', 'DIAGNOSTIC'), 128 * 1024 * 1024, 'utf8');
  } finally { closeSync(update); }
  await expect(runReviewCommand(root, review.groups[0].id, { decision: 'needs-test', reason: 'boundary' })).rejects.toThrow('context changed');
  const malformed = { files: { 'a.js': { source: 'x', mutants: [{ id: '1', status: 'Survived', mutatorName: 'StringLiteral', replacement: 'y', testsCompleted: 0,
    location: { start: { line: 1, column: 1 }, end: { line: 1, column: 2 } } }] } } };
  const zeroTests = openSync(file, 'r+');
  try { writeSync(zeroTests, JSON.stringify(malformed) + ' '.repeat(100), 128 * 1024 * 1024, 'utf8'); }
  finally { closeSync(zeroTests); }
  await expect(readReviewInput(root, file)).rejects.toThrow('executed 0 tests');
}, 30000);
