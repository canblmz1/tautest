import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readLargeReviewReport } from '../packages/cli/src/lib/large-review-input';

// Maintainer reproduction, not evidence of independent adoption.
// pnpm exec tsx scripts/check-large-report-import.mts RAW_REPORT COMPACT_REFERENCE
const [input, reference] = process.argv.slice(2).map(p => path.resolve(p));
assert.ok(input && reference, 'Pass the original report and an independently compacted JSON reference.');
const started = Date.now();
const result = await readLargeReviewReport(input);
assert.deepEqual(result.value, JSON.parse(readFileSync(reference, 'utf8')));
const originalHash = createHash('sha256');
for await (const chunk of createReadStream(input)) originalHash.update(chunk);
assert.equal(result.hash, originalHash.digest('hex'));

const root = mkdtempSync(path.join(tmpdir(), 'tautest-large-import-'));
const probe = path.join(root, 'memory-probe.mjs');
const metrics = path.join(root, 'memory.json');
writeFileSync(probe, `import {writeFileSync} from 'node:fs'; process.on('exit',()=>writeFileSync(${JSON.stringify(metrics)},JSON.stringify(process.resourceUsage())));`);
const run = spawnSync(process.execPath, ['--max-old-space-size=128', '--import', pathToFileURL(probe).href,
  path.resolve('packages/cli/dist/index.js'), 'analyze', '--from', input, '--json'],
  { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 180000, windowsHide: true });
assert.equal(run.status, 0, run.stderr || String(run.error));
const review = JSON.parse(run.stdout);
assert.equal(review.input.sha256, result.hash);
assert.equal(review.input.importDetails.omittedStatusReasons, result.importDetails.omittedStatusReasons);
assert.equal(review.complete, true);
assert.equal(review.contextHash, null);
const evidence = { checkedAt: new Date().toISOString(), inputSha256: result.hash, importDetails: result.importDetails,
  matchesIndependentReference: true, originalHashAfterImportMatches: true,
  cliExitCode: run.status, cliHeapLimitMiB: 128, cliMaxRssKiB: JSON.parse(readFileSync(metrics, 'utf8')).maxRSS,
  summary: review.rawSummary, expressionGroups: review.groups.length,
  elapsedMs: Date.now() - started, externalAdoption: false };
console.log(JSON.stringify(evidence, null, 2));
