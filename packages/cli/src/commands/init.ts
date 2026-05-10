import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  detectPackageManager,
  detectProject,
  detectTestRunner,
  type PackageManager,
  type TestRunner
} from '@tautest/core';
import { appendGitignoreEntry, writeTextFile } from '../lib/fs';
import { addStrykerDevDependencies, installCommandForPackageManager } from '../lib/package-json';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';

export interface InitOptions {
  yes?: boolean;
  noInstall?: boolean;
  install?: boolean;
  runner?: TestRunner;
  pm?: PackageManager;
}

export interface InitResult {
  rootDir: string;
  configPath: string;
  runner: TestRunner;
  packageManager: PackageManager;
  installed: boolean;
  addedDependencies: string[];
  gitignoreChanged: boolean;
}

export async function runInit(cwd: string, options: InitOptions): Promise<InitResult> {
  const project = detectProject(cwd);

  if (!project.packageJsonPath || !project.packageJson) {
    throw new CliError('No package.json found.', EXIT_CODES.detectionError, 'Run `tautest init` from a Node.js project.');
  }

  const detectedRunner = detectTestRunner(project);
  const runner = options.runner ?? detectedRunner.runner;

  if (!runner) {
    throw new CliError(detectedRunner.reason, EXIT_CODES.detectionError, 'Install Vitest/Jest or pass `--runner vitest`.');
  }

  const packageManager = options.pm ?? detectPackageManager(project.rootDir, project.packageJson).packageManager;
  const configPath = path.join(project.rootDir, 'tautest.config.ts');
  const gitignorePath = path.join(project.rootDir, '.gitignore');
  const backups = snapshotFiles([configPath, gitignorePath, project.packageJsonPath]);

  try {
    if (!existsSync(configPath)) {
      writeTextFile(configPath, buildConfigFile(runner));
    }

    const gitignoreChanged = appendGitignoreEntry(gitignorePath, '.tautest/');
    const dependencyResult = addStrykerDevDependencies(project.packageJsonPath, runner);
    let installed = false;

    if (!options.noInstall && options.install !== false && dependencyResult.added.length > 0) {
      const command = installCommandForPackageManager(packageManager);
      const result = spawnSync(command.command, command.args, {
        cwd: project.rootDir,
        stdio: 'inherit',
        shell: false
      });

      if (result.status !== 0) {
        restoreFiles(backups);
        throw new CliError(
          `${command.command} ${command.args.join(' ')} failed during dependency installation.`,
          EXIT_CODES.detectionError,
          'Re-run `tautest init --no-install`, inspect package.json, then install dependencies manually.'
        );
      }

      installed = true;
    }

    return {
      rootDir: project.rootDir,
      configPath,
      runner,
      packageManager,
      installed,
      addedDependencies: dependencyResult.added,
      gitignoreChanged
    };
  } catch (error) {
    if (!(error instanceof CliError)) {
      restoreFiles(backups);
    }

    throw error;
  }
}

export function formatInitResult(result: InitResult): string {
  return [
    'Tautest initialized',
    '',
    `Project: ${result.rootDir}`,
    `Config: ${result.configPath}`,
    `Runner: ${result.runner}`,
    `Package manager: ${result.packageManager}`,
    `Added dependencies: ${result.addedDependencies.length > 0 ? result.addedDependencies.join(', ') : 'none'}`,
    `.gitignore updated: ${result.gitignoreChanged ? 'yes' : 'already ignored'}`,
    `Install ran: ${result.installed ? 'yes' : 'no'}`
  ].join('\n');
}

function buildConfigFile(runner: TestRunner): string {
  return `import { defineConfig } from '@tautest/core';

export default defineConfig({
  testRunner: '${runner}',
  baseRef: 'HEAD',
  outputDir: '.tautest',
  stryker: {
    incremental: false
  }
});
`;
}

function snapshotFiles(filePaths: string[]): Map<string, string | null> {
  return new Map(filePaths.map((filePath) => [filePath, existsSync(filePath) ? readFileSync(filePath, 'utf8') : null]));
}

function restoreFiles(snapshots: Map<string, string | null>): void {
  for (const [filePath, contents] of snapshots) {
    if (contents === null) {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } else {
      writeFileSync(filePath, contents);
    }
  }
}
