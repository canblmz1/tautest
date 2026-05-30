import * as core from '@actions/core';
import type { PackageManagerInput } from './inputs';
import { execCommand } from './exec';
import { installCommand } from './package-manager';

export async function installDependencies(cwd: string, packageManager: Exclude<PackageManagerInput, 'auto'>): Promise<void> {
  const command = installCommand(packageManager);
  core.info(`Installing dependencies with ${packageManager}.`);
  const result = await execCommand(command.command, command.args, cwd, false);

  if (result.exitCode !== 0) {
    throw new Error(`Dependency install failed with ${packageManager}.`);
  }
}

export async function ensurePackageManagerAvailable(packageManager: Exclude<PackageManagerInput, 'auto'>, cwd: string): Promise<void> {
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
