import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PackageJson, ProjectInfo } from '../types';

const VITEST_CONFIG_FILES = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
const JEST_CONFIG_FILES = ['jest.config.ts', 'jest.config.js', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'];

export function detectProject(startDir: string): ProjectInfo {
  const packageJsonPath = findPackageJson(startDir);
  const rootDir = packageJsonPath ? path.dirname(packageJsonPath) : path.resolve(startDir);
  const packageJson = packageJsonPath ? readJsonFile<PackageJson>(packageJsonPath) : null;
  const tsconfigPath = findExisting(rootDir, ['tsconfig.json']);
  const tsconfig = tsconfigPath ? readJsonFile<TsConfig>(tsconfigPath) : null;
  const monorepoSignals = [...detectMonorepoSignals(rootDir, packageJson), ...detectAncestorMonorepoSignals(rootDir)];

  return {
    rootDir,
    packageJsonPath,
    packageJson,
    hasTypeScript: Boolean(tsconfigPath || hasDependency(packageJson, 'typescript')),
    vitestConfigFiles: findExistingMany(rootDir, VITEST_CONFIG_FILES),
    jestConfigFiles: findExistingMany(rootDir, JEST_CONFIG_FILES),
    monorepo: {
      detected: monorepoSignals.length > 0,
      signals: monorepoSignals
    },
    tsconfig: {
      path: tsconfigPath,
      baseUrl: stringOrUndefined(tsconfig?.compilerOptions?.baseUrl),
      paths: pathsOrUndefined(tsconfig?.compilerOptions?.paths)
    }
  };
}

export function findPackageJson(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, 'package.json');

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

export function detectMonorepoSignals(rootDir: string, packageJson?: PackageJson | null): string[] {
  const signals: string[] = [];

  if (packageJson?.workspaces) {
    signals.push('package.json workspaces');
  }

  for (const fileName of ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json', 'rush.json']) {
    if (existsSync(path.join(rootDir, fileName))) {
      signals.push(fileName);
    }
  }

  return signals;
}

function detectAncestorMonorepoSignals(rootDir: string): string[] {
  const signals: string[] = [];
  let current = path.dirname(path.resolve(rootDir));

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = readJsonFile<PackageJson>(packageJsonPath);

        if (packageJson.workspaces) {
          signals.push(`ancestor package.json workspaces at ${current}`);
        }
      } catch {
        // Ignore unreadable ancestor manifests; detection is advisory only.
      }
    }

    for (const fileName of ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json', 'rush.json']) {
      if (existsSync(path.join(current, fileName))) {
        signals.push(`ancestor ${fileName} at ${current}`);
      }
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return signals;
    }

    current = parent;
  }
}

function findExisting(rootDir: string, fileNames: string[]): string | null {
  return findExistingMany(rootDir, fileNames)[0] ?? null;
}

function findExistingMany(rootDir: string, fileNames: string[]): string[] {
  return fileNames.map((fileName) => path.join(rootDir, fileName)).filter((filePath) => existsSync(filePath));
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function hasDependency(packageJson: PackageJson | null, name: string): boolean {
  return Boolean(packageJson?.dependencies?.[name] ?? packageJson?.devDependencies?.[name] ?? packageJson?.peerDependencies?.[name]);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function pathsOrUndefined(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string'));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

interface TsConfig {
  compilerOptions?: {
    baseUrl?: unknown;
    paths?: unknown;
  };
}
