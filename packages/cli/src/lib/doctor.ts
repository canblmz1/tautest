import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  detectPackageManager,
  detectProject,
  detectTestRunner,
  type PackageManagerDetection,
  type ProjectInfo,
  type TestRunnerDetection
} from '@tautest/core';

export type DoctorStatus = 'ok' | 'warning' | 'error';

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
  suggestion?: string;
}

export interface DoctorReport {
  cwd: string;
  errors: DoctorCheck[];
  warnings: DoctorCheck[];
  checks: DoctorCheck[];
}

export function runDoctor(cwd: string): DoctorReport {
  const project = safeDetectProject(cwd);
  const packageManager = project.packageJson ? detectPackageManager(project.rootDir, project.packageJson) : null;
  const testRunner = project.packageJson ? detectTestRunner(project) : null;
  const checks: DoctorCheck[] = [
    checkNodeVersion(),
    checkGitAvailable(cwd),
    checkGitRepo(cwd),
    checkShallowClone(cwd),
    checkPackageJson(project),
    checkTestRunner(testRunner),
    checkStrykerDependencies(project),
    checkRunnerConfig(project, testRunner),
    checkJestBeta(testRunner),
    checkMonorepo(project),
    checkExistingStrykerConfig(project),
    checkTautestGitignored(project),
    checkPackageManager(packageManager)
  ];

  return {
    cwd,
    checks,
    errors: checks.filter((check) => check.status === 'error'),
    warnings: checks.filter((check) => check.status === 'warning')
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines = ['Tautest doctor', ''];

  for (const check of report.checks) {
    lines.push(`${symbol(check.status)} ${check.name}: ${check.message}`);

    if (check.suggestion) {
      lines.push(`  Suggestion: ${check.suggestion}`);
    }
  }

  lines.push('');
  lines.push(`Result: ${report.errors.length} error(s), ${report.warnings.length} warning(s)`);
  return lines.join('\n');
}

function safeDetectProject(cwd: string): ProjectInfo {
  return detectProject(cwd);
}

function checkNodeVersion(): DoctorCheck {
  const major = Number(process.versions.node.split('.')[0]);

  if (major >= 20) {
    return { name: 'Node.js', status: 'ok', message: `Node ${process.versions.node}` };
  }

  return {
    name: 'Node.js',
    status: 'error',
    message: `Node ${process.versions.node} is below the supported minimum.`,
    suggestion: 'Use Node.js 20 or newer.'
  };
}

function checkGitAvailable(cwd: string): DoctorCheck {
  try {
    const version = execGit(['--version'], cwd).trim();
    return { name: 'Git binary', status: 'ok', message: version };
  } catch {
    return {
      name: 'Git binary',
      status: 'error',
      message: 'Git was not found.',
      suggestion: 'Install Git and make sure it is available on PATH.'
    };
  }
}

function checkGitRepo(cwd: string): DoctorCheck {
  try {
    const root = execGit(['rev-parse', '--show-toplevel'], cwd).trim();
    return { name: 'Git repository', status: 'ok', message: root };
  } catch {
    return {
      name: 'Git repository',
      status: 'error',
      message: 'Current directory is not inside a Git repository.',
      suggestion: 'Run Tautest from a Git checkout.'
    };
  }
}

function checkShallowClone(cwd: string): DoctorCheck {
  try {
    const output = execGit(['rev-parse', '--is-shallow-repository'], cwd).trim();

    if (output === 'true') {
      return {
        name: 'Git history',
        status: 'warning',
        message: 'Repository is a shallow clone.',
        suggestion: 'Fetch enough history for the selected --base ref.'
      };
    }

    return { name: 'Git history', status: 'ok', message: 'Repository is not shallow.' };
  } catch {
    return {
      name: 'Git history',
      status: 'warning',
      message: 'Could not determine shallow clone status.'
    };
  }
}

function checkPackageJson(project: ProjectInfo): DoctorCheck {
  if (project.packageJsonPath) {
    return { name: 'package.json', status: 'ok', message: project.packageJsonPath };
  }

  return {
    name: 'package.json',
    status: 'error',
    message: 'No package.json found.',
    suggestion: 'Run Tautest from a Node.js project.'
  };
}

function checkTestRunner(testRunner: TestRunnerDetection | null): DoctorCheck {
  if (!testRunner) {
    return {
      name: 'Test runner',
      status: 'error',
      message: 'Could not inspect test runner without package.json.'
    };
  }

  if (testRunner.runner) {
    return { name: 'Test runner', status: 'ok', message: `${testRunner.runner}: ${testRunner.reason}` };
  }

  return {
    name: 'Test runner',
    status: 'error',
    message: testRunner.reason,
    suggestion: 'Install Vitest or Jest, or pass --runner during init.'
  };
}

function checkStrykerDependencies(project: ProjectInfo): DoctorCheck {
  const deps = {
    ...project.packageJson?.dependencies,
    ...project.packageJson?.devDependencies,
    ...project.packageJson?.peerDependencies
  };
  const hasCore = Boolean(deps['@stryker-mutator/core']);
  const hasRunner = Boolean(deps['@stryker-mutator/vitest-runner'] || deps['@stryker-mutator/jest-runner']);

  if (hasCore && hasRunner) {
    return { name: 'Stryker dependencies', status: 'ok', message: 'Stryker core and runner dependency found.' };
  }

  return {
    name: 'Stryker dependencies',
    status: 'warning',
    message: 'Missing Stryker core or runner dependency.',
    suggestion: 'Run `tautest init` to add the required devDependencies.'
  };
}

function checkRunnerConfig(project: ProjectInfo, testRunner: TestRunnerDetection | null): DoctorCheck {
  if (testRunner?.runner === 'vitest' && project.vitestConfigFiles.length > 0) {
    return { name: 'Runner config', status: 'ok', message: project.vitestConfigFiles[0] };
  }

  if (testRunner?.runner === 'jest' && project.jestConfigFiles.length > 0) {
    return { name: 'Runner config', status: 'ok', message: project.jestConfigFiles[0] };
  }

  return {
    name: 'Runner config',
    status: 'warning',
    message: 'No matching Vitest/Jest config file found.',
    suggestion: 'Tautest can still run for simple projects, but explicit runner config is safer.'
  };
}

function checkJestBeta(testRunner: TestRunnerDetection | null): DoctorCheck {
  if (testRunner?.runner !== 'jest') {
    return { name: 'Jest beta', status: 'ok', message: 'Not using Jest.' };
  }

  return {
    name: 'Jest beta',
    status: 'warning',
    message: 'Jest support is beta.',
    suggestion: 'Prefer a plain Node Jest setup first. ESM, ts-jest, Babel, custom environments, and path aliases may need explicit Jest/Stryker configuration.'
  };
}

function checkMonorepo(project: ProjectInfo): DoctorCheck {
  if (project.monorepo.detected) {
    return {
      name: 'Monorepo signals',
      status: 'warning',
      message: project.monorepo.signals.join(', '),
      suggestion: 'V1 only detects monorepos; run Tautest from a package root.'
    };
  }

  return { name: 'Monorepo signals', status: 'ok', message: 'No monorepo signal detected.' };
}

function checkExistingStrykerConfig(project: ProjectInfo): DoctorCheck {
  const files = ['stryker.config.json', 'stryker.config.js', 'stryker.config.mjs', 'stryker.conf.json', 'stryker.conf.js'];
  const found = files.map((file) => path.join(project.rootDir, file)).find((file) => existsSync(file));

  if (found) {
    return {
      name: 'Existing Stryker config',
      status: 'warning',
      message: found,
      suggestion: 'Tautest will generate its own programmatic Stryker config and may not use every existing option.'
    };
  }

  return { name: 'Existing Stryker config', status: 'ok', message: 'No existing Stryker config found.' };
}

function checkTautestGitignored(project: ProjectInfo): DoctorCheck {
  const gitignorePath = path.join(project.rootDir, '.gitignore');

  if (!existsSync(gitignorePath)) {
    return {
      name: '.tautest gitignore',
      status: 'warning',
      message: 'No .gitignore file found.',
      suggestion: 'Run `tautest init` to add `.tautest/`.'
    };
  }

  const ignored = /(^|\r?\n)\.tautest\/?(\r?\n|$)/.test(readFileSync(gitignorePath, 'utf8'));

  if (ignored) {
    return { name: '.tautest gitignore', status: 'ok', message: '.tautest/ is ignored.' };
  }

  return {
    name: '.tautest gitignore',
    status: 'warning',
    message: '.tautest/ is not ignored.',
    suggestion: 'Run `tautest init` or add `.tautest/` to .gitignore.'
  };
}

function checkPackageManager(packageManager: PackageManagerDetection | null): DoctorCheck {
  if (!packageManager) {
    return { name: 'Package manager', status: 'warning', message: 'Could not detect package manager.' };
  }

  return { name: 'Package manager', status: 'ok', message: `${packageManager.packageManager}: ${packageManager.reason}` };
}

function execGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function symbol(status: DoctorStatus): string {
  if (status === 'ok') {
    return 'OK';
  }

  if (status === 'warning') {
    return 'WARN';
  }

  return 'ERR';
}
