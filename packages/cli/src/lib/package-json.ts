import { readFileSync, writeFileSync } from 'node:fs';
import type { PackageJson, PackageManager, TestRunner } from '@tautest/core';

export function addStrykerDevDependencies(packageJsonPath: string, runner: TestRunner): { changed: boolean; added: string[] } {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
  const original = JSON.stringify(packageJson, null, 2);
  const coreVersion = packageJson.devDependencies?.['@stryker-mutator/core'] ?? packageJson.dependencies?.['@stryker-mutator/core'];
  const dependencies = strykerDependenciesForRunner(runner, coreVersion ?? '^10.0.0');
  packageJson.devDependencies = packageJson.devDependencies ?? {};

  const added: string[] = [];

  for (const [name, version] of Object.entries(dependencies)) {
    if (!packageJson.devDependencies[name] && !packageJson.dependencies?.[name]) {
      if (coreVersion && !/^[~^]?\d+\.\d+\.\d+$/.test(coreVersion)) {
        throw new Error(`Cannot choose a matching Stryker runner for core spec "${coreVersion}". Install ${name} manually, then run tautest init again.`);
      }
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

function strykerDependenciesForRunner(runner: TestRunner, version: string): Record<string, string> {
  if (runner === 'jest') {
    return {
      '@stryker-mutator/core': version,
      '@stryker-mutator/jest-runner': version
    };
  }

  return {
    '@stryker-mutator/core': version,
    '@stryker-mutator/vitest-runner': version
  };
}

function commandName(command: string): string {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}
