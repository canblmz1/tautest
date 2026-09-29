import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import JSON5 from 'json5';
import type { PackageJson, ProjectInfo } from '../types';

const VITEST_CONFIG_FILES = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'vite.config.ts', 'vite.config.js', 'vite.config.mjs'];
const JEST_CONFIG_FILES = ['jest.config.ts', 'jest.config.js', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'];

export function detectProject(startDir: string): ProjectInfo {
  const packageJsonPath = findPackageJson(startDir);
  const rootDir = packageJsonPath ? path.dirname(packageJsonPath) : path.resolve(startDir);
  const packageJson = packageJsonPath ? readJsonFile<PackageJson>(packageJsonPath) : null;
  const tsconfigPath = findExisting(rootDir, ['tsconfig.json']);
  const tsconfig = tsconfigPath ? readTsConfig(tsconfigPath) : null;
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
      paths: pathsOrUndefined(tsconfig?.compilerOptions?.paths),
      unrewrittenExtends: unrewrittenTsconfigExtends(rootDir, tsconfigPath, tsconfig)
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

// tsconfig.json is JSON with comments and trailing commas (`tsc --init` writes comments), so plain
// JSON.parse rejects many real ones; JSON5 accepts both. It is only read here for baseUrl/paths
// hints — Stryker and TypeScript parse it themselves — so an unreadable tsconfig must not stop the run.
function readTsConfig(filePath: string): TsConfig | null {
  try {
    return JSON5.parse(readFileSync(filePath, 'utf8')) as TsConfig;
  } catch {
    return null;
  }
}

// Mirrors Stryker's sandbox tsconfig rewrite: starting at tsconfig.json, a string `extends` that
// leaves the project is rewritten, and one that stays inside is followed when it names an existing
// file. `extends` arrays, and files reached only by appending `.json`, are left untouched, so any
// outside path reached through them points nowhere in the sandbox and Vitest finds no tests.
function unrewrittenTsconfigExtends(rootDir: string, tsconfigPath: string | null, tsconfig: TsConfig | null): string[] {
  const unrewritten = new Set<string>();
  const visited = new Set<string>();

  function scan(configPath: string, config: TsConfig, followedByStryker: boolean): void {
    if (visited.has(configPath)) {
      return;
    }
    visited.add(configPath);

    const isArray = Array.isArray(config.extends);
    const rewritten = followedByStryker && !isArray;

    for (const entry of isArray ? (config.extends as unknown[]) : [config.extends]) {
      // Package names resolve through node_modules, and absolute paths still work from the sandbox.
      if (typeof entry !== 'string' || !entry.startsWith('.')) {
        continue;
      }

      const resolved = path.resolve(path.dirname(configPath), entry);
      const relative = path.relative(rootDir, resolved);

      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        if (!rewritten) {
          unrewritten.add(relative.split(path.sep).join('/'));
        }
        continue;
      }

      const next = isFile(resolved) ? resolved : isFile(`${resolved}.json`) ? `${resolved}.json` : undefined;
      const nested = next ? readTsConfig(next) : null;

      if (next && nested) {
        scan(next, nested, rewritten && next === resolved);
      }
    }
  }

  if (tsconfigPath && tsconfig) {
    scan(tsconfigPath, tsconfig, true);
  }

  return [...unrewritten];
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
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
  extends?: unknown;
  compilerOptions?: {
    baseUrl?: unknown;
    paths?: unknown;
  };
}
