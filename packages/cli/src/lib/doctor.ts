import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  detectPackageManager,
  detectProject,
  detectTestRunner,
  type PackageManagerDetection,
  type ProjectInfo,
  type TautestConfig,
  type TestRunnerDetection
} from '@tautest/core';
import { loadCliConfig } from './config';

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

export async function runDoctor(cwd: string): Promise<DoctorReport> {
  const project = safeDetectProject(cwd);
  const config = await safeLoadTautestConfig(project);
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
    checkRunnerConfig(project, testRunner, config),
    checkJestCompatibility(project, testRunner, config),
    checkJestTransformStack(project, testRunner, config),
    checkJestEnvironment(project, testRunner, config),
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

async function safeLoadTautestConfig(project: ProjectInfo): Promise<TautestConfig | null> {
  if (!project.packageJsonPath) {
    return null;
  }

  try {
    return await loadCliConfig(project.rootDir);
  } catch {
    return null;
  }
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

function checkRunnerConfig(project: ProjectInfo, testRunner: TestRunnerDetection | null, config: TautestConfig | null): DoctorCheck {
  if (testRunner?.runner === 'vitest' && project.vitestConfigFiles.length > 0) {
    return { name: 'Runner config', status: 'ok', message: project.vitestConfigFiles[0] };
  }

  if (testRunner?.runner === 'jest' && project.jestConfigFiles.length > 0) {
    return { name: 'Runner config', status: 'ok', message: project.jestConfigFiles[0] };
  }

  if (testRunner?.runner === 'vitest' && config?.stryker.vitestConfigFile) {
    return checkConfiguredRunnerConfig(project, config.stryker.vitestConfigFile, 'Vitest');
  }

  if (testRunner?.runner === 'jest' && config?.stryker.jestConfigFile) {
    return checkConfiguredRunnerConfig(project, config.stryker.jestConfigFile, 'Jest');
  }

  return {
    name: 'Runner config',
    status: 'warning',
    message: 'No matching Vitest/Jest config file found.',
    suggestion: 'Tautest can still run for simple projects, but explicit runner config is safer.'
  };
}

function checkConfiguredRunnerConfig(project: ProjectInfo, configuredPath: string, runnerName: string): DoctorCheck {
  const resolved = path.resolve(project.rootDir, configuredPath);

  if (existsSync(resolved)) {
    return {
      name: 'Runner config',
      status: 'ok',
      message: `${runnerName} config from tautest config: ${resolved}`
    };
  }

  return {
    name: 'Runner config',
    status: 'warning',
    message: `${runnerName} config from tautest config was not found: ${resolved}`,
    suggestion: `Check stryker.${runnerName.toLowerCase()}ConfigFile in tautest.config.*.`
  };
}

function checkJestCompatibility(project: ProjectInfo, testRunner: TestRunnerDetection | null, config: TautestConfig | null): DoctorCheck {
  if (testRunner?.runner !== 'jest') {
    return { name: 'Jest compatibility', status: 'ok', message: 'Not using Jest.' };
  }

  const configFile = resolveJestConfigFile(project, testRunner, config);

  if (configFile?.endsWith('.ts')) {
    return {
      name: 'Jest compatibility',
      status: 'warning',
      message: 'Jest was detected with a TypeScript Jest config file.',
      suggestion: 'Prefer jest.config.cjs, jest.config.js, jest.config.mjs, or jest.config.json for Tautest. TypeScript Jest config files may need custom loader/Stryker configuration.'
    };
  }

  return {
    name: 'Jest compatibility',
    status: 'ok',
    message: 'Jest detected. Tested fixture paths include CommonJS, ESM, and Babel TypeScript.',
    suggestion: 'Use stryker.jestConfigFile in tautest.config.* when the Jest config is not at the project root.'
  };
}

function checkJestTransformStack(project: ProjectInfo, testRunner: TestRunnerDetection | null, config: TautestConfig | null): DoctorCheck {
  if (testRunner?.runner !== 'jest') {
    return { name: 'Jest transform stack', status: 'ok', message: 'Not using Jest.' };
  }

  const deps = allDependencies(project);
  const configText = readOptional(resolveJestConfigFile(project, testRunner, config));
  const mentionsTsJest = deps.has('ts-jest') || /['"]ts-jest['"]|preset\s*:\s*['"]ts-jest['"]/.test(configText);

  if (mentionsTsJest) {
    return {
      name: 'Jest transform stack',
      status: 'warning',
      message: 'ts-jest detected. This path is not fixture-backed yet.',
      suggestion: 'Prefer the Babel TypeScript path in examples/jest-typescript, or keep explicit Stryker/Jest config and expect beta-level behavior.'
    };
  }

  if (/['"]babel-jest['"]/.test(configText)) {
    if (deps.has('babel-jest')) {
      return {
        name: 'Jest transform stack',
        status: 'ok',
        message: 'babel-jest transform detected; this is covered by the TypeScript Jest fixture.'
      };
    }

    return {
      name: 'Jest transform stack',
      status: 'warning',
      message: 'Jest config references babel-jest, but babel-jest is not installed.',
      suggestion: 'Install babel-jest and the matching Babel presets, or remove the transform.'
    };
  }

  if (/\btransform\s*:/.test(configText)) {
    return {
      name: 'Jest transform stack',
      status: 'warning',
      message: 'Custom Jest transforms detected.',
      suggestion: 'Run `tautest doctor` after adding explicit stryker.jestConfigFile and compare against examples/jest-typescript.'
    };
  }

  return {
    name: 'Jest transform stack',
    status: 'ok',
    message: 'No custom Jest transform stack detected.'
  };
}

function checkJestEnvironment(project: ProjectInfo, testRunner: TestRunnerDetection | null, config: TautestConfig | null): DoctorCheck {
  if (testRunner?.runner !== 'jest') {
    return { name: 'Jest environment', status: 'ok', message: 'Not using Jest.' };
  }

  const configText = readOptional(resolveJestConfigFile(project, testRunner, config));
  const environmentMatch = configText.match(/\btestEnvironment\s*:\s*['"]([^'"]+)['"]/);

  if (!environmentMatch) {
    return {
      name: 'Jest environment',
      status: 'ok',
      message: 'No custom Jest testEnvironment detected.'
    };
  }

  const environment = environmentMatch[1];

  if (environment === 'node') {
    return {
      name: 'Jest environment',
      status: 'ok',
      message: 'Jest node environment detected.'
    };
  }

  if (environment === 'jsdom') {
    const deps = allDependencies(project);

    if (deps.has('jest-environment-jsdom')) {
      return {
        name: 'Jest environment',
        status: 'ok',
        message: 'Jest jsdom environment dependency found.'
      };
    }

    return {
      name: 'Jest environment',
      status: 'warning',
      message: 'Jest jsdom environment detected without jest-environment-jsdom dependency.',
      suggestion: 'Install jest-environment-jsdom or use testEnvironment: "node" for non-DOM tests.'
    };
  }

  return {
    name: 'Jest environment',
    status: 'warning',
    message: `Custom Jest testEnvironment detected: ${environment}.`,
    suggestion: 'Custom environments can require extra Stryker/Jest wiring; validate with a small changed-line smoke PR.'
  };
}

function resolveJestConfigFile(project: ProjectInfo, testRunner: TestRunnerDetection | null, config: TautestConfig | null): string | undefined {
  if (config?.stryker.jestConfigFile) {
    return path.resolve(project.rootDir, config.stryker.jestConfigFile);
  }

  return testRunner?.configFile ?? project.jestConfigFiles[0];
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

function allDependencies(project: ProjectInfo): Set<string> {
  return new Set([
    ...Object.keys(project.packageJson?.dependencies ?? {}),
    ...Object.keys(project.packageJson?.devDependencies ?? {}),
    ...Object.keys(project.packageJson?.peerDependencies ?? {})
  ]);
}

function readOptional(filePath: string | undefined): string {
  if (!filePath || !existsSync(filePath)) {
    return '';
  }

  return readFileSync(filePath, 'utf8');
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
