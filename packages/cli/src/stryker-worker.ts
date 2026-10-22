import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadConfigFile, reviewHash, runStryker, type RunStrykerOptions } from '@tautest/core';
import { assertFreshSource, projectFile } from './lib/review-input';

interface Request { root: string; sourceFile: string; source: string; testFile: string; testHash: string; startLine: number; endLine: number; runner?: string; reportRunner?: string; output: string }

async function main(): Promise<void> {
  const request = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Request;
  assertFreshSource(request.root, request.sourceFile, request.source);
  projectFile(request.root, request.testFile);
  let local: Record<string, unknown> = {};
  for (const name of ['stryker.config.json', 'stryker.config.mjs', 'stryker.config.js', 'stryker.config.cjs', 'stryker.conf.json', 'stryker.conf.mjs', 'stryker.conf.js', 'stryker.conf.cjs']) {
    const file = path.join(request.root, name);
    if (!existsSync(file)) continue;
    const loaded = await loadConfigFile(file);
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) throw new Error(`Invalid project Stryker config: ${name}`);
    local = loaded as Record<string, unknown>;
    break;
  }
  const runner = request.runner ?? local.testRunner ?? (['vitest', 'jest'].includes(request.reportRunner ?? '') ? request.reportRunner : undefined);
  if (typeof runner !== 'string' || !runner) throw new Error('Specify --runner or configure testRunner in the project Stryker config.');
  // Execute only the project's config. Never evaluate or replay config embedded in a report.
  // The engine's initial dry run must pass before it can produce a completed result.
  const config: RunStrykerOptions['config'] = {
    ...local, testRunner: runner,
    // Stryker's default plugin glob scans beside its own installation. With pnpm,
    // the project's runner can be installed in a different virtual-store directory.
    // Append the runner without disabling default discovery of other plugins.
    ...(local.plugins === undefined && (runner === 'vitest' || runner === 'jest')
      && (local.appendPlugins === undefined || Array.isArray(local.appendPlugins))
      ? { appendPlugins: [...new Set([...(local.appendPlugins as string[] | undefined ?? []), `@stryker-mutator/${runner}-runner`])] } : {}),
    mutate: [`${request.sourceFile}:${request.startLine}-${request.endLine}`],
    reporters: ['json'], jsonReporter: { fileName: path.join(request.output, 'mutation.json') },
    thresholds: { high: 80, low: 60, break: 0 },
    inPlace: false, incremental: false, dryRunOnly: false,
    tempDirName: '.stryker-tmp', cleanTempDir: 'always'
  };
  assertFreshSource(request.root, request.sourceFile, request.source);
  if (reviewHash(readFileSync(projectFile(request.root, request.testFile), 'utf8')) !== request.testHash) throw new Error('Candidate test changed before verification.');
  await runStryker({ cwd: request.root, config, jsonReportPath: path.join(request.output, 'mutation.json') });
  writeFileSync(path.join(request.output, 'completed.json'), JSON.stringify({ initialTestRunPassed: true }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
