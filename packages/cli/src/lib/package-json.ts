import { readFileSync, writeFileSync } from 'node:fs';
import type { PackageJson, PackageManager, TestRunner } from '@tautest/core';

export function addStrykerDevDependencies(packageJsonPath: string, runner: TestRunner): { changed: boolean; added: string[] } {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  const original = JSON.stringify(packageJson, null, 2);
  const dependencies = strykerDependenciesForRunner(runner);
  packageJson.devDependencies = packageJson.devDependencies ?? {};

  const added: string[] = [];

  for (const [name, version] of Object.entries(dependencies)) {
    if (!packageJson.devDependencies[name] && !packageJson.dependencies?.[name]) {
      packageJson.devDependencies[name] = version;
      added.push(name);
    }
  }

  const next = `${JSON.stringify(packageJson, null, 2)}\n`;

  if (next.trim() !== original.trim()) {
    writeFileSync(packageJsonPath, next);
    return { changed: true, added };
  }

  return { changed: false, added };
}

export function installCommandForPackageManager(packageManager: PackageManager): { command: string; args: string[] } {
  if (packageManager === 'pnpm') {
    return { command: commandName('pnpm'), args: ['install'] };
  }

  if (packageManager === 'yarn') {
    return { command: commandName('yarn'), args: ['install'] };
  }

  if (packageManager === 'bun') {
    return { command: commandName('bun'), args: ['install'] };
  }

  return { command: commandName('npm'), args: ['install'] };
}

function strykerDependenciesForRunner(runner: TestRunner): Record<string, string> {
  if (runner === 'jest') {
    return {
      '@stryker-mutator/core': '^9.6.1',
      '@stryker-mutator/jest-runner': '^9.6.1'
    };
  }

  return {
    '@stryker-mutator/core': '^9.6.1',
    '@stryker-mutator/vitest-runner': '^9.6.1'
  };
}

function commandName(command: string): string {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}
