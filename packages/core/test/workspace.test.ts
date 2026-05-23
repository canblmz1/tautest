import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorkspacePlan, detectWorkspace, findOwningPackage, parsePackageSelectors, selectAffectedWorkspacePackages, type ChangedFile } from '../src';

describe('workspace detection', () => {
  it('detects pnpm workspace packages from yaml patterns', () => {
    const root = createWorkspaceFixture();

    const workspace = detectWorkspace(root);

    expect(workspace).toMatchObject({
      detected: true,
      source: 'pnpm-workspace.yaml',
      packageManager: 'pnpm',
      patterns: ['packages/*'],
      confidence: 'high'
    });
    expect(workspace.packages.map((workspacePackage) => workspacePackage.path)).toEqual(['packages/api', 'packages/shared', 'packages/web']);
    expect(workspace.packages.map((workspacePackage) => workspacePackage.name)).toEqual(['@fixture/api', '@fixture/shared', '@fixture/web']);
  });

  it('detects package.json workspaces when pnpm yaml is absent', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-workspace-'));
    mkdirSync(path.join(root, 'apps', 'web'), { recursive: true });
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root', workspaces: { packages: ['apps/*'] } }));
    writeFileSync(path.join(root, 'apps', 'web', 'package.json'), JSON.stringify({ name: 'web' }));

    const workspace = detectWorkspace(root);

    expect(workspace.source).toBe('package.json workspaces');
    expect(workspace.packages.map((workspacePackage) => workspacePackage.path)).toEqual(['apps/web']);
  });
});

describe('workspace planning', () => {
  it('selects packages affected by changed files and old rename paths', () => {
    const root = createWorkspaceFixture();
    const workspace = detectWorkspace(root);
    const changedFiles = [
      changedFile('packages/api/src/index.ts'),
      changedFile('packages/web/src/new.ts', {
        status: 'renamed',
        oldPath: 'packages/shared/src/old.ts'
      })
    ];

    const affected = selectAffectedWorkspacePackages(workspace.packages, changedFiles);

    expect(affected.selections.filter((selection) => selection.selected).map((selection) => selection.path)).toEqual(['packages/api', 'packages/shared', 'packages/web']);
    expect(findOwningPackage(workspace.packages, 'packages/api/src/index.ts')?.name).toBe('@fixture/api');
  });

  it('selects every package conservatively for root config changes', () => {
    const root = createWorkspaceFixture();
    const plan = buildWorkspacePlan({
      cwd: root,
      mode: 'affected',
      changedFiles: [changedFile('pnpm-workspace.yaml', { isSource: false })]
    });

    expect(plan.selectedPackages.map((selection) => selection.path)).toEqual(['packages/api', 'packages/shared', 'packages/web']);
    expect(plan.warnings[0]).toContain('all packages were selected conservatively');
  });

  it('supports explicit package selectors by name or path', () => {
    const root = createWorkspaceFixture();
    const plan = buildWorkspacePlan({
      cwd: root,
      mode: 'packages',
      packages: ['@fixture/api', 'packages/web'],
      changedFiles: []
    });

    expect(plan.selectedPackages.map((selection) => selection.path)).toEqual(['packages/api', 'packages/web']);
    expect(parsePackageSelectors('@fixture/api, packages/web')).toEqual(['@fixture/api', 'packages/web']);
  });
});

function createWorkspaceFixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-workspace-'));

  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root', packageManager: 'pnpm@10.0.0' }));
  writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');

  for (const name of ['api', 'shared', 'web']) {
    const packageDir = path.join(root, 'packages', name);
    mkdirSync(path.join(packageDir, 'src'), { recursive: true });
    writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: `@fixture/${name}` }));
  }

  return root;
}

function changedFile(filePath: string, overrides: Partial<ChangedFile> = {}): ChangedFile {
  return {
    path: filePath,
    status: 'modified',
    ranges: [{ start: 1, end: 1 }],
    isSource: true,
    isTest: false,
    isBinary: false,
    warnings: [],
    ...overrides
  };
}
