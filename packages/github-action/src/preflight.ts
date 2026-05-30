import path from 'node:path';
import { existsSync } from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import type { ActionInputs, PackageManagerInput } from './inputs';
import { execCommand, isPathInside } from './exec';
import { detectPackageManager } from './package-manager';

export interface PreflightResult {
  workspaceRoot: string;
  workingDirectory: string;
  base: string;
  isPullRequest: boolean;
  pullRequestNumber?: number;
  packageManager: Exclude<PackageManagerInput, 'auto'>;
  headRef: string;
}

export async function runPreflight(inputs: ActionInputs): Promise<PreflightResult> {
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
