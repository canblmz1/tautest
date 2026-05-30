import { existsSync } from 'node:fs';
import path from 'node:path';
import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { emitSurvivorAnnotations } from './annotations';
import { restoreTautestCache, saveTautestCache, type TautestCache } from './cache';
import { execCommand, type ExecResult } from './exec';
import { ensurePackageManagerAvailable, installDependencies } from './install';
import { readInputs, type ActionInputs, type PackageManagerInput } from './inputs';
import { buildCacheSummary, buildCommentReport, setActionOutputs, type TautestActionOutput } from './output';
import { runPreflight, type PreflightResult } from './preflight';
import { buildPrComment, upsertStickyComment } from './pr-comment';
import { writeStepSummary, type StepSummaryCache } from './summary';
import { buildTautestRunArgs, extractJson, formatTautestCliDiagnostics, resolveTautestCommand, type TautestCommand } from './tautest-cli';

interface TautestRunResult extends ExecResult {
  attemptedCommand: TautestCommand;
}

export async function run(): Promise<void> {
  const inputs = readInputs();

  if (inputs.githubToken) {
    core.setSecret(inputs.githubToken);
  }

  const preflight = await runPreflight(inputs);
  let cacheState: TautestCache | null = null;
  let cacheSummary: StepSummaryCache | undefined = inputs.cache ? undefined : { enabled: false };

  if (inputs.install) {
    await ensurePackageManagerAvailable(preflight.packageManager, preflight.workingDirectory);
    await installDependencies(preflight.workingDirectory, preflight.packageManager);
  } else {
    core.info('Skipping dependency install because input `install` is false.');
  }

  if (inputs.cache) {
    cacheState = await restoreTautestCache({
      workingDirectory: preflight.workingDirectory,
      base: preflight.base,
      headRef: preflight.headRef,
      packageManager: preflight.packageManager
    });
    cacheSummary = buildCacheSummary(cacheState);
  }

  const runResult = await runTautest(preflight.workspaceRoot, preflight.workingDirectory, inputs, preflight.base, preflight.packageManager);

  if (runResult.exitCode !== 0 && runResult.exitCode !== 1 && runResult.exitCode !== 2) {
    throw new Error(
      await buildTautestFailureMessage('Tautest failed before producing an accepted exit code.', preflight.workingDirectory, runResult)
    );
  }

  let parsedOutput: TautestActionOutput;

  try {
    parsedOutput = parseTautestOutput(runResult.stdout);
  } catch (error) {
    throw new Error(
      await buildTautestFailureMessage(
        error instanceof Error ? error.message : 'Tautest did not produce parseable JSON output.',
        preflight.workingDirectory,
        runResult
      )
    );
  }

  await uploadTautestArtifact(preflight.workingDirectory);

  if (inputs.cache) {
    const saveResult = await saveTautestCache(cacheState);
    cacheSummary = {
      ...(cacheSummary ?? { enabled: true }),
      saveStatus: saveResult.status,
      saveMessage: saveResult.message
    };
  }

  setActionOutputs(parsedOutput);
  await writeStepSummary({ ...parsedOutput, cache: cacheSummary });
  maybeAnnotate(inputs, parsedOutput);
  await maybeComment(inputs, preflight, parsedOutput);

  if (runResult.exitCode === 1 && inputs.failOnThreshold) {
    core.setFailed('Tautest completed, but the mutation score is below the configured threshold.');
    return;
  }

}

function maybeAnnotate(inputs: ActionInputs, output: TautestActionOutput): void {
  if (inputs.annotations === 'never') {
    core.info('Skipping annotations because input `annotations` is never.');
    return;
  }

  if (output.status === 'no-op') {
    core.info('Skipping annotations because Tautest found no changed production source files.');
    return;
  }

  const count = emitSurvivorAnnotations(output.report?.surviving ?? []);
  core.info(`Tautest annotations emitted: ${count}.`);
}

async function runTautest(
  workspaceRoot: string,
  cwd: string,
  inputs: ActionInputs,
  base: string,
  packageManager: Exclude<PackageManagerInput, 'auto'>
): Promise<TautestRunResult> {
  const command = resolveTautestCommand(workspaceRoot, {
    workingDirectory: cwd,
    packageManager
  });
  const args = buildTautestRunArgs(command, inputs, base);

  core.info(`Running Tautest in ${cwd} using ${command.strategy}.`);
  const result = await execCommand(command.command, args, cwd);
  return { ...result, attemptedCommand: command };
}

function parseTautestOutput(stdout: string): TautestActionOutput {
  const jsonText = extractJson(stdout);

  if (!jsonText) {
    throw new Error('Tautest did not produce JSON output. Make sure the installed CLI supports `tautest run --json`.');
  }

  return JSON.parse(jsonText) as TautestActionOutput;
}

async function buildTautestFailureMessage(reason: string, cwd: string, result: TautestRunResult): Promise<string> {
  const versionCommand = {
    command: result.attemptedCommand.command,
    args: [...result.attemptedCommand.args, '--version']
  };
  const versionCheck = await execCommand(versionCommand.command, versionCommand.args, cwd);
  const message = formatTautestCliDiagnostics({
    reason,
    command: result.attemptedCommand,
    result,
    versionCommand,
    versionCheck
  });

  core.startGroup('Tautest CLI diagnostics');
  core.info(message);
  core.endGroup();

  return message;
}

async function maybeComment(inputs: ActionInputs, preflight: PreflightResult, output: TautestActionOutput): Promise<void> {
  if (inputs.comment === 'never') {
    core.info('Skipping PR comment because input `comment` is never.');
    return;
  }

  if (!preflight.isPullRequest || !preflight.pullRequestNumber) {
    core.info('Skipping PR comment because this workflow is not running for a pull request.');
    return;
  }

  if (inputs.comment === 'changes' && output.status === 'no-op') {
    core.info('Skipping PR comment because Tautest found no changed production source files.');
    return;
  }

  const report = buildCommentReport(output);
  const body = buildPrComment(report);
  const { owner, repo } = github.context.repo;
  const result = await upsertStickyComment({
    token: inputs.githubToken,
    owner,
    repo,
    issueNumber: preflight.pullRequestNumber,
    body
  });

  core.info(`Tautest PR comment: ${result}.`);
}

async function uploadTautestArtifact(workingDirectory: string): Promise<void> {
  if (!process.env.ACTIONS_RUNTIME_TOKEN && !process.env.ACTIONS_RESULTS_URL) {
    core.warning('Skipping artifact upload because GitHub Actions artifact runtime variables are not available.');
    return;
  }

  const files = ['report.md', 'report.json', 'fix-prompt.md', 'mutation.json']
    .map((fileName) => path.join(workingDirectory, '.tautest', fileName))
    .filter((filePath) => existsSync(filePath));

  if (files.length === 0) {
    core.warning('No Tautest artifact files were found under .tautest/.');
    return;
  }

  const client = new DefaultArtifactClient();
  await client.uploadArtifact('tautest-report', files, workingDirectory, {
    retentionDays: 14
  });
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
