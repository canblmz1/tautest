import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'tinyglobby';
import { parse as parseYaml } from 'yaml';
import { detectPackageManager } from '../detect/package-manager';
import type { PackageJson, WorkspaceDetection, WorkspacePackage, WorkspaceSource } from '../types';

export function findWorkspaceRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    const packageJson = existsSync(packageJsonPath) ? readJsonFile<PackageJson>(packageJsonPath) : null;

    if (existsSync(path.join(current, 'pnpm-workspace.yaml')) || hasWorkspaceField(packageJson)) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function detectWorkspace(startDir: string): WorkspaceDetection {
  const rootDir = findWorkspaceRoot(startDir) ?? path.resolve(startDir);
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = existsSync(packageJsonPath) ? readJsonFile<PackageJson>(packageJsonPath) : null;
  const { source, patterns, warnings } = readWorkspacePatterns(rootDir, packageJson);
  const packages = patterns.length > 0 ? readWorkspacePackages(rootDir, patterns, warnings) : [];
  const packageManager = source === 'none' ? null : detectPackageManager(rootDir, packageJson).packageManager;
  const detected = source !== 'none';

  if (detected && packages.length === 0) {
    warnings.push('Workspace patterns were found, but no package manifests matched.');
  }

  return {
    detected,
    rootDir,
    source,
    packageManager,
    patterns,
    packages,
    confidence: !detected ? 'low' : packages.length > 0 ? 'high' : 'medium',
    warnings
  };
}

export function readWorkspacePackages(rootDir: string, patterns: string[], warnings: string[] = []): WorkspacePackage[] {
  const includePatterns = patterns.filter((pattern) => !pattern.trim().startsWith('!')).map(toPackageJsonPattern);
  const ignorePatterns = [
    '**/node_modules/**',
    ...patterns
      .filter((pattern) => pattern.trim().startsWith('!'))
      .map((pattern) => toPackageJsonPattern(pattern.trim().slice(1)))
  ];

  const manifests = globSync(includePatterns, {
    cwd: rootDir,
    dot: true,
    onlyFiles: true,
    ignore: ignorePatterns
  });
  const uniqueManifests = [...new Set(manifests.map(toPosix))].sort();
  const packages: WorkspacePackage[] = [];

  for (const manifest of uniqueManifests) {
    const packageJsonPath = path.join(rootDir, manifest);

    try {
      const packageJson = readJsonFile<PackageJson>(packageJsonPath);
      const packagePath = toPosix(path.dirname(manifest));

      packages.push({
        name: typeof packageJson.name === 'string' ? packageJson.name : null,
        path: packagePath === '.' ? '.' : packagePath,
        absolutePath: path.dirname(packageJsonPath),
        packageJsonPath,
        packageJson
      });
    } catch {
      warnings.push(`Could not read workspace package manifest at ${manifest}.`);
    }
  }

  return packages.sort((left, right) => left.path.localeCompare(right.path));
}

function readWorkspacePatterns(rootDir: string, packageJson: PackageJson | null): { source: WorkspaceSource; patterns: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const pnpmWorkspacePath = path.join(rootDir, 'pnpm-workspace.yaml');

  if (existsSync(pnpmWorkspacePath)) {
    try {
      const parsed = parseYaml(readFileSync(pnpmWorkspacePath, 'utf8')) as { packages?: unknown } | null;
      const patterns = stringArray(parsed?.packages);

      if (patterns.length > 0) {
        return { source: 'pnpm-workspace.yaml', patterns, warnings };
      }

      warnings.push('pnpm-workspace.yaml does not contain a packages array.');
      return { source: 'pnpm-workspace.yaml', patterns: [], warnings };
    } catch (error) {
      warnings.push(`Could not parse pnpm-workspace.yaml: ${error instanceof Error ? error.message : String(error)}`);
      return { source: 'pnpm-workspace.yaml', patterns: [], warnings };
    }
  }

  const packageJsonWorkspaces = readPackageJsonWorkspacePatterns(packageJson?.workspaces);

  if (packageJsonWorkspaces.length > 0) {
    return { source: 'package.json workspaces', patterns: packageJsonWorkspaces, warnings };
  }

  return { source: 'none', patterns: [], warnings };
}

function readPackageJsonWorkspacePatterns(value: unknown): string[] {
  if (Array.isArray(value)) {
    return stringArray(value);
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return stringArray((value as { packages?: unknown }).packages);
  }

  return [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim()) : [];
}

function toPackageJsonPattern(pattern: string): string {
  const normalized = toPosix(pattern.trim()).replace(/\/+$/, '');

  if (normalized === '.' || normalized === '') {
    return 'package.json';
  }

  if (normalized.endsWith('/package.json')) {
    return normalized;
  }

  return `${normalized}/package.json`;
}

function hasWorkspaceField(packageJson: PackageJson | null): boolean {
  return readPackageJsonWorkspacePatterns(packageJson?.workspaces).length > 0;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}
