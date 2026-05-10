import * as core from '@actions/core';

export type CommentMode = 'always' | 'changes' | 'never';
export type PackageManagerInput = 'auto' | 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface ActionInputs {
  base?: string;
  threshold: number;
  failOnThreshold: boolean;
  comment: CommentMode;
  config?: string;
  workingDirectory: string;
  packageManager: PackageManagerInput;
  install: boolean;
  cache: boolean;
  githubToken?: string;
}

export function readInputs(): ActionInputs {
  return parseInputs({
    base: core.getInput('base'),
    threshold: core.getInput('threshold'),
    failOnThreshold: core.getInput('fail-on-threshold'),
    comment: core.getInput('comment'),
    config: core.getInput('config'),
    workingDirectory: core.getInput('working-directory'),
    packageManager: core.getInput('package-manager'),
    install: core.getInput('install'),
    cache: core.getInput('cache'),
    githubToken: core.getInput('github-token')
  });
}

export function parseInputs(raw: Record<string, string | undefined>): ActionInputs {
  const threshold = parseThreshold(raw.threshold || '60');

  return {
    base: blankToUndefined(raw.base),
    threshold,
    failOnThreshold: parseBoolean(raw.failOnThreshold || 'true', 'fail-on-threshold'),
    comment: parseCommentMode(raw.comment || 'changes'),
    config: blankToUndefined(raw.config),
    workingDirectory: raw.workingDirectory?.trim() || '.',
    packageManager: parsePackageManager(raw.packageManager || 'auto'),
    install: parseBoolean(raw.install || 'false', 'install'),
    cache: parseBoolean(raw.cache || 'true', 'cache'),
    githubToken: blankToUndefined(raw.githubToken)
  };
}

function parseThreshold(value: string): number {
  const threshold = Number(value);

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error('Input `threshold` must be a number between 0 and 100.');
  }

  return threshold;
}

function parseBoolean(value: string, inputName: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Input \`${inputName}\` must be either true or false.`);
}

function parseCommentMode(value: string): CommentMode {
  if (value === 'always' || value === 'changes' || value === 'never') {
    return value;
  }

  throw new Error('Input `comment` must be one of always, changes, or never.');
}

function parsePackageManager(value: string): PackageManagerInput {
  if (value === 'auto' || value === 'npm' || value === 'pnpm' || value === 'yarn' || value === 'bun') {
    return value;
  }

  throw new Error('Input `package-manager` must be one of auto, npm, pnpm, yarn, or bun.');
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
