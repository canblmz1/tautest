import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { restoreTautestCache, saveTautestCache, type TautestCache } from './cache';
import { readInputs, type ActionInputs, type PackageManagerInput } from './inputs';
import { buildPrComment, type CommentReport, upsertStickyComment } from './pr-comment';
import { writeStepSummary } from './summary';
import { extractJson, formatTautestCliDiagnostics, resolveTautestCommand, type TautestCommand } from './tautest-cli';

interface PreflightResult {
  workspaceRoot: string;
  workingDirectory: string;
  base: string;
  isPullRequest: boolean;
  pullRequestNumber?: number;
  packageManager: Exclude<PackageManagerInput, 'auto'>;
  headRef: string;
}

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface TautestRunResult extends ExecResult {
  attemptedCommand: TautestCommand;
}

interface TautestActionOutput {
  status: 'passed' | 'threshold-failed' | 'no-op' | string;
  threshold?: number;
  message?: string;
  report?: {
    summary?: {
      verdict?: string;
      mutationScore?: number | null;
      killed?: number;
      survived?: number;
      noCoverage?: number;
    };
    surviving?: Array<{
      filePath: string;
      line: number;
      mutatorName: string;
      original: string;
      replacement: string;
    }>;
  };
  paths?: {
    report?: string;
    json?: string;
    prompt?: string;
    mutationJson?: string;
  };
}

export async function run(): Promise<void> {
  const inputs = readInputs();

  if (inputs.githubToken) {
    core.setSecret(inputs.githubToken);
  }

  const preflight = await runPreflight(inputs);
  let cacheState: TautestCache | null = null;

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
  }

  const runResult = await runTautest(preflight.workspaceRoot, preflight.workingDirectory, inputs, preflight.base);

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
    await saveTautestCache(cacheState);
  }

  setActionOutputs(parsedOutput);
  await writeStepSummary(parsedOutput);
  await maybeComment(inputs, preflight, parsedOutput);

  if (runResult.exitCode === 1 && inputs.failOnThreshold) {
    core.setFailed('Tautest completed, but the mutation score is below the configured threshold.');
    return;
  }

}

async function runPreflight(inputs: ActionInputs): Promise<PreflightResult> {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const workspaceRoot = path.resolve(workspace);
  const workingDirectory = path.resolve(workspaceRoot, inputs.workingDirectory);
  const pullRequest = github.context.payload.pull_request;
  const isPullRequest = Boolean(pullRequest);
  const base = inputs.base || pullRequest?.base?.sha;

  if (!isPathInside(workingDirectory, workspaceRoot)) {
    throw new Error(`Working directory must stay inside GITHUB_WORKSPACE. Received: ${inputs.workingDirectory}`);
  }

  if (!existsSync(workingDirectory)) {
    throw new Error(`Working directory does not exist: ${workingDirectory}`);
  }

  if (!base) {
    throw new Error('No base ref was provided and this workflow is not running in a pull request context.');
  }

  await assertGitRepository(workingDirectory);
  await warnIfShallowClone(workingDirectory);

  if (!isPullRequest) {
    core.warning('This workflow is not running in a pull request context. Tautest can run, but PR comments will be skipped.');
  }

  const packageManager = inputs.packageManager === 'auto' ? detectPackageManager(workingDirectory) : inputs.packageManager;

  return {
    workspaceRoot,
    workingDirectory,
    base,
    isPullRequest,
    pullRequestNumber: pullRequest?.number,
    packageManager,
    headRef: pullRequest?.head?.ref || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'detached'
  };
}

async function assertGitRepository(cwd: string): Promise<void> {
  const result = await execCommand('git', ['rev-parse', '--show-toplevel'], cwd);

  if (result.exitCode !== 0) {
    throw new Error('Working directory is not inside a Git repository.');
  }
}

async function warnIfShallowClone(cwd: string): Promise<void> {
  const result = await execCommand('git', ['rev-parse', '--is-shallow-repository'], cwd);

  if (result.stdout.trim() === 'true') {
    core.warning('Repository is a shallow clone. Use actions/checkout with fetch-depth: 0 so Tautest can diff against the PR base.');
  }
}

async function installDependencies(cwd: string, packageManager: Exclude<PackageManagerInput, 'auto'>): Promise<void> {
  const command = installCommand(packageManager);
  core.info(`Installing dependencies with ${packageManager}.`);
  const result = await execCommand(command.command, command.args, cwd, false);

  if (result.exitCode !== 0) {
    throw new Error(`Dependency install failed with ${packageManager}.`);
  }
}

async function ensurePackageManagerAvailable(packageManager: Exclude<PackageManagerInput, 'auto'>, cwd: string): Promise<void> {
  const version = await execCommand(packageManager, ['--version'], cwd);

  if (version.exitCode === 0) {
    return;
  }

  if (packageManager === 'pnpm' || packageManager === 'yarn') {
    core.info(`${packageManager} was not found on PATH. Trying corepack enable.`);
    await execCommand('corepack', ['enable'], cwd, false);
    const afterCorepack = await execCommand(packageManager, ['--version'], cwd);

    if (afterCorepack.exitCode === 0) {
      return;
    }
  }

  throw new Error(`Package manager ${packageManager} is not available on PATH. Install it before this action or use a setup action.`);
}

async function runTautest(workspaceRoot: string, cwd: string, inputs: ActionInputs, base: string): Promise<TautestRunResult> {
  const command = resolveTautestCommand(workspaceRoot);
  const args = [
    ...command.args,
    'run',
    '--base',
    base,
    '--threshold',
    String(inputs.threshold),
    '--json'
  ];

  if (inputs.config) {
    args.push('--config', inputs.config);
  }

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
  const versionCheck = await execCommand('pnpm', ['exec', 'tautest', '--version'], cwd);
  const message = formatTautestCliDiagnostics({
    reason,
    command: result.attemptedCommand,
    result,
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

function setActionOutputs(output: TautestActionOutput): void {
  const summary = output.report?.summary;
  const score = summary?.mutationScore;
  const verdict = summary?.verdict || (output.status === 'no-op' ? 'NO_CHANGES' : '');
  const surviving = summary?.survived ?? output.report?.surviving?.length ?? 0;

  core.setOutput('score', score === null || score === undefined ? '' : String(score));
  core.setOutput('verdict', verdict);
  core.setOutput('surviving', String(surviving));
  core.setOutput('report-path', output.paths?.report || '');
}

function buildCommentReport(output: TautestActionOutput): CommentReport {
  const summary = output.report?.summary;

  return {
    score: summary?.mutationScore ?? null,
    verdict: summary?.verdict || (output.status === 'no-op' ? 'NO_CHANGES' : 'UNKNOWN'),
    killed: summary?.killed ?? 0,
    survived: summary?.survived ?? 0,
    noCoverage: summary?.noCoverage ?? 0,
    reportPath: output.paths?.report,
    fixPromptPath: output.paths?.prompt,
    topMutants: output.report?.surviving ?? []
  };
}

function detectPackageManager(cwd: string): Exclude<PackageManagerInput, 'auto'> {
  const packageJsonPath = findUp(cwd, 'package.json');

  if (packageJsonPath) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { packageManager?: string };
    const declared = parsePackageManagerField(packageJson.packageManager);

    if (declared) {
      core.info(`Detected package manager from package.json: ${declared}.`);
      return declared;
    }
  }

  for (const [fileName, packageManager] of [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm']
  ] as const) {
    if (findUp(cwd, fileName)) {
      core.info(`Detected package manager from ${fileName}: ${packageManager}.`);
      return packageManager;
    }
  }

  core.warning('Could not detect package manager from packageManager field or lockfile. Falling back to npm.');
  return 'npm';
}

function parsePackageManagerField(value: unknown): Exclude<PackageManagerInput, 'auto'> | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.split('@')[0];
  return name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun' ? name : null;
}

function installCommand(packageManager: Exclude<PackageManagerInput, 'auto'>): { command: string; args: string[] } {
  if (packageManager === 'pnpm') {
    return { command: 'pnpm', args: ['install', '--frozen-lockfile'] };
  }

  if (packageManager === 'yarn') {
    return { command: 'yarn', args: ['install', '--frozen-lockfile'] };
  }

  if (packageManager === 'bun') {
    return { command: 'bun', args: ['install', '--frozen-lockfile'] };
  }

  return { command: 'npm', args: ['ci'] };
}

function findUp(startDir: string, relativePath: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, relativePath);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function isPathInside(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function execCommand(command: string, args: string[], cwd: string, silent = true): Promise<ExecResult> {
  let stdout = '';
  let stderr = '';
  const exitCode = await exec.exec(command, args, {
    cwd,
    silent,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data) => {
        stdout += data.toString();
      },
      stderr: (data) => {
        stderr += data.toString();
      }
    }
  });

  return { exitCode, stdout, stderr };
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
