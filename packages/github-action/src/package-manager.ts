import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import type { PackageManagerInput } from './inputs';
import { findUp } from './exec';

export function detectPackageManager(cwd: string): Exclude<PackageManagerInput, 'auto'> {
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

export function parsePackageManagerField(value: unknown): Exclude<PackageManagerInput, 'auto'> | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.split('@')[0];
  return name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun' ? name : null;
}

export function installCommand(packageManager: Exclude<PackageManagerInput, 'auto'>): { command: string; args: string[] } {
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
