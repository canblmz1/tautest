import type { ChangedFile, WorkspacePackage, WorkspacePackageSelection } from '../types';

export function selectAffectedWorkspacePackages(packages: WorkspacePackage[], changedFiles: ChangedFile[]): { selections: WorkspacePackageSelection[]; warnings: string[] } {
  const reasonsByPackage = new Map<string, string[]>();
  const warnings: string[] = [];

  for (const file of changedFiles) {
    const rootReason = rootChangeReason(file.path);

    if (rootReason) {
      for (const workspacePackage of packages) {
        addReason(reasonsByPackage, workspacePackage.path, rootReason);
      }
      warnings.push(`${file.path} affects workspace-level configuration; all packages were selected conservatively.`);
      continue;
    }

    const owner = findOwningPackage(packages, file.path);

    if (owner) {
      addPackageAndDependents(reasonsByPackage, packages, owner, changedFileReason(file));
    }

    if (file.oldPath && file.oldPath !== file.path) {
      const oldOwner = findOwningPackage(packages, file.oldPath);

      if (oldOwner) {
        addPackageAndDependents(reasonsByPackage, packages, oldOwner, `previous path ${file.oldPath}`);
      }
    }

    if (!owner && file.isSource) {
      for (const workspacePackage of packages) {
        addReason(reasonsByPackage, workspacePackage.path, `unowned source change ${file.path}`);
      }
      warnings.push(`${file.path} is a source file outside known packages; all packages were selected conservatively.`);
    }
  }

  return {
    selections: packages.map((workspacePackage) => {
      const reasons = reasonsByPackage.get(workspacePackage.path) ?? [];
      return {
        ...workspacePackage,
        selected: reasons.length > 0,
        reasons
      };
    }),
    warnings
  };
}

export function findOwningPackage(packages: WorkspacePackage[], filePath: string): WorkspacePackage | null {
  const normalized = toPosix(filePath);
  const owners = packages.filter((workspacePackage) => {
    if (workspacePackage.path === '.') {
      return true;
    }

    return normalized === workspacePackage.path || normalized.startsWith(`${workspacePackage.path}/`);
  });

  return owners.sort((left, right) => right.path.length - left.path.length)[0] ?? null;
}

function changedFileReason(file: ChangedFile): string {
  if (file.status === 'deleted') {
    return `deleted ${file.path}`;
  }

  if (file.status === 'renamed') {
    return `renamed ${file.oldPath ?? file.path} -> ${file.path}`;
  }

  return `changed ${file.path}`;
}

function rootChangeReason(filePath: string): string | null {
  const normalized = toPosix(filePath);

  if (
    normalized === 'package.json' ||
    normalized === 'pnpm-lock.yaml' ||
    normalized === 'package-lock.json' ||
    normalized === 'yarn.lock' ||
    normalized === 'bun.lock' ||
    normalized === 'bun.lockb' ||
    normalized === 'pnpm-workspace.yaml' ||
    normalized === 'turbo.json' ||
    normalized === 'nx.json' ||
    normalized === 'lerna.json' ||
    normalized.startsWith('.github/')
  ) {
    return `workspace-level change ${normalized}`;
  }

  return null;
}

function addReason(reasonsByPackage: Map<string, string[]>, packagePath: string, reason: string): void {
  const reasons = reasonsByPackage.get(packagePath) ?? [];

  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }

  reasonsByPackage.set(packagePath, reasons);
}

function addPackageAndDependents(reasonsByPackage: Map<string, string[]>, packages: WorkspacePackage[], owner: WorkspacePackage, reason: string): void {
  addReason(reasonsByPackage, owner.path, reason);

  if (!owner.name) {
    return;
  }

  for (const workspacePackage of packages) {
    if (workspacePackage.path !== owner.path && packageDependsOn(workspacePackage, owner.name)) {
      addReason(reasonsByPackage, workspacePackage.path, `depends on changed package ${owner.name}`);
    }
  }
}

function packageDependsOn(workspacePackage: WorkspacePackage, dependencyName: string): boolean {
  return Boolean(
    workspacePackage.packageJson.dependencies?.[dependencyName] ||
      workspacePackage.packageJson.devDependencies?.[dependencyName] ||
      workspacePackage.packageJson.peerDependencies?.[dependencyName]
  );
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}
