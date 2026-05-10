import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PackageJson, PackageManager, PackageManagerDetection } from '../types';

const LOCKFILES: Array<{ file: string; packageManager: PackageManager }> = [
  { file: 'pnpm-lock.yaml', packageManager: 'pnpm' },
  { file: 'yarn.lock', packageManager: 'yarn' },
  { file: 'bun.lock', packageManager: 'bun' },
  { file: 'bun.lockb', packageManager: 'bun' },
  { file: 'package-lock.json', packageManager: 'npm' }
];

export function detectPackageManager(rootDir: string, packageJson?: PackageJson | null): PackageManagerDetection {
  const packageManager = parsePackageManagerField(packageJson?.packageManager);

  if (packageManager) {
    return {
      packageManager,
      reason: `package.json packageManager field declares ${packageManager}.`
    };
  }

  for (const lockfile of LOCKFILES) {
    const lockfilePath = findLockfile(rootDir, lockfile.file);

    if (lockfilePath) {
      return {
        packageManager: lockfile.packageManager,
        lockfile: lockfilePath,
        reason: `Detected ${lockfile.file}.`
      };
    }
  }

  const ancestorPackageManager = findAncestorPackageManager(rootDir);

  if (ancestorPackageManager) {
    return ancestorPackageManager;
  }

  const ancestorLockfile = findAncestorLockfile(rootDir);

  if (ancestorLockfile) {
    return ancestorLockfile;
  }

  return {
    packageManager: 'npm',
    reason: 'No packageManager field or known lockfile found; defaulting to npm.'
  };
}

export function parsePackageManagerField(value: unknown): PackageManager | null {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.split('@')[0];

  if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') {
    return name;
  }

  return null;
}

function findLockfile(rootDir: string, fileName: string): string | null {
  const lockfilePath = path.join(rootDir, fileName);
  return existsSync(lockfilePath) ? lockfilePath : null;
}

function findAncestorPackageManager(rootDir: string): PackageManagerDetection | null {
  let current = path.dirname(path.resolve(rootDir));

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
        const packageManager = parsePackageManagerField(packageJson.packageManager);

        if (packageManager) {
          return {
            packageManager,
            reason: `Parent package.json packageManager field declares ${packageManager}.`
          };
        }
      } catch {
        // Ignore unreadable parent manifests; local detection should remain best effort.
      }
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function findAncestorLockfile(rootDir: string): PackageManagerDetection | null {
  let current = path.dirname(path.resolve(rootDir));

  while (true) {
    for (const lockfile of LOCKFILES) {
      const lockfilePath = findLockfile(current, lockfile.file);

      if (lockfilePath) {
        return {
          packageManager: lockfile.packageManager,
          lockfile: lockfilePath,
          reason: `Detected parent ${lockfile.file}.`
        };
      }
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}
