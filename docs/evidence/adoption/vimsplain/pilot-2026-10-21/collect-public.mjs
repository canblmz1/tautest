import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2]);
const destination = path.resolve(process.argv[3] ?? path.join(here, 'observed'));
mkdirSync(destination, { recursive: true });
const read = file => JSON.parse(readFileSync(path.join(out, file), 'utf8'));
const write = (file, value) => writeFileSync(path.join(destination, file), JSON.stringify(value, null, 2) + '\n');
const evidence = read('evidence.json');
const plan = read('plan.json');
const diff = readFileSync(path.join(out, 'real-source-diff.patch'), 'utf8');
// Compare the CLI's actual ranges to raw git new-side hunk coordinates. No Tautest
// diff parser is used for this check. This pinned diff has no source deletions.
const changed = new Set();
let file;
for (const line of diff.split(/\r?\n/)) {
  if (line.startsWith('+++ b/')) file = line.slice(6);
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!hunk || !file?.startsWith('src/') || !file.endsWith('.ts') || file.endsWith('.types.ts') || file === 'src/index.ts') continue;
  const count = Number(hunk[2] ?? 1);
  for (let i = 0; i < count; i++) changed.add(`${file}:${Number(hunk[1]) + i}`);
}
const planned = new Set();
for (const pattern of plan.mutatePatterns) {
  const [, file, start, end] = /^(.+):(\d+)-(\d+)$/.exec(pattern) ?? [];
  if (!file) throw new Error('Unexpected range pattern.');
  for (let i = Number(start); i <= Number(end); i++) planned.add(`${file}:${i}`);
}
if (!changed.size || changed.size !== planned.size || [...changed].some(line => !planned.has(line))) throw new Error('Planner ranges disagree with raw git hunks.');
if (planned.has('src/handlers/command.ts:22')) throw new Error('Do not claim this old survivor is in the recent diff.');
write('scope-proof.json', { head: evidence.head, base: evidence.base, rangeCoalesceGap: 0,
  rawGitNewSideLines: changed.size, plannedLines: planned.size, exactMatch: true, mutatePatterns: plan.mutatePatterns,
  whitespaceTargetInRecentDiff: false, diffSha256: createHash('sha256').update(diff).digest('hex') });
copyFileSync(path.join(out, 'real-source-diff.patch'), path.join(destination, 'recent-source.diff'));

function portable(report) {
  const needed = new Set(Object.values(report.files).flatMap(f => f.mutants.flatMap(m => [...(m.coveredBy ?? []), ...(m.killedBy ?? [])])));
  const testFiles = Object.fromEntries(Object.entries(report.testFiles ?? {}).map(([file, entry]) => [file,
    { tests: (entry.tests ?? []).filter(t => needed.has(t.id)) }]).filter(([, entry]) => entry.tests.length));
  return { schemaVersion: report.schemaVersion, framework: report.framework, files: report.files, testFiles,
    config: { testRunner: report.config.testRunner, coverageAnalysis: report.config.coverageAnalysis, mutate: report.config.mutate } };
}
write('before.target.json', portable(read('before.mutation.json')));
for (const v of evidence.verifications) write(v.label + '.target.json', portable(JSON.parse(readFileSync(path.join(v.evidence.paths.directory, 'mutation.json'), 'utf8'))));
const candidate = readFileSync(path.join(here, 'ex-command-whitespace.test.ts'), 'utf8');
const candidateFile = 'packages/vimsplain/' + evidence.candidate.file;
const lines = candidate.trimEnd().split('\n');
writeFileSync(path.join(here, 'candidate.patch'), `diff --git a/${candidateFile} b/${candidateFile}\nnew file mode 100644\n--- /dev/null\n+++ b/${candidateFile}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line => '+' + line).join('\n')}\n`);
write('evidence.json', { observedAt: evidence.checkedAt, repo: evidence.repo, issue: evidence.issue, head: evidence.head, base: evidence.base,
  node: evidence.node, packageManager: evidence.packageManager, tautest: evidence.tautest, installed: evidence.installed,
  lockfileSha256: evidence.lockfileSha256, toolLockfileSha256: evidence.toolLockfileSha256,
  sourceBytesSha256: evidence.sourceBytesSha256, sourceSha256LF: evidence.sourceSha256LF,
  sourceUnchanged: evidence.sourceUnchanged, baseline: { passed: evidence.baseline.passed, files: evidence.baseline.files.map(f => ({ file: f.file, count: f.tests.length })) },
  candidate: evidence.candidate, fingerprint: evidence.fingerprint, before: evidence.before,
  verifications: evidence.verifications.map(v => ({ label: v.label, status: v.status, fingerprint: v.fingerprint, mutant: v.mutant, killers: v.killers })),
  steps: evidence.steps.map(s => ({ label: s.label, exitCode: s.exitCode, elapsedMs: s.elapsedMs })),
  limits: evidence.limits, independentTrial: false, userValidatedBenefit: false, repeatUse: false });
console.log(JSON.stringify({ exactDiffMatch: true, changedLines: changed.size, destination }));
