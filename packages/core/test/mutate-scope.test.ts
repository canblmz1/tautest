import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { markOutsideMutateScope, readStrykerMutateScope } from '../src/stryker/mutate-scope';
import type { ChangedFile } from '../src/types';

function projectWith(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-mutate-scope-'));

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }

  return root;
}

function changedSource(filePath: string): ChangedFile {
  return { path: filePath, status: 'modified', ranges: [{ start: 1, end: 1 }], isSource: true, isTest: false, isBinary: false, warnings: [] };
}

describe('readStrykerMutateScope', () => {
  it('reads mutate globs from stryker.config.json', async () => {
    const root = projectWith({ 'stryker.config.json': JSON.stringify({ mutate: ['src/**/*.ts'] }) });

    expect(await readStrykerMutateScope(root)).toEqual(['src/**/*.ts']);
  });

  it('reads mutate globs from an ESM Stryker config', async () => {
    const root = projectWith({ 'stryker.config.mjs': "export default { mutate: ['lib/**/*.js'] };\n" });

    expect(await readStrykerMutateScope(root)).toEqual(['lib/**/*.js']);
  });

  it('returns undefined when the project has no Stryker config', async () => {
    const root = projectWith({ 'package.json': '{}' });

    expect(await readStrykerMutateScope(root)).toBeUndefined();
  });

  it('returns undefined when the Stryker config does not set mutate', async () => {
    const root = projectWith({ 'stryker.config.json': JSON.stringify({ testRunner: 'vitest' }) });

    expect(await readStrykerMutateScope(root)).toBeUndefined();
  });
});

describe('markOutsideMutateScope', () => {
  it('keeps changed files inside the mutate globs and excludes the rest', () => {
    const root = projectWith({ 'src/price.ts': '', 'scripts/build.mjs': '' });

    const [price, build] = markOutsideMutateScope([changedSource('src/price.ts'), changedSource('scripts/build.mjs')], ['src/**/*.ts'], root);

    expect(price).toMatchObject({ path: 'src/price.ts', isSource: true });
    expect(build).toMatchObject({ path: 'scripts/build.mjs', isSource: false, outsideMutateScope: true });
  });

  it('honors negated mutate globs', () => {
    const root = projectWith({ 'src/app.ts': '', 'src/generated/client.ts': '' });

    const [app, generated] = markOutsideMutateScope(
      [changedSource('src/app.ts'), changedSource('src/generated/client.ts')],
      ['src/**/*.ts', '!src/generated/**'],
      root
    );

    expect(app.isSource).toBe(true);
    expect(generated).toMatchObject({ isSource: false, outsideMutateScope: true });
  });

  it('treats line-range mutate entries as their file', () => {
    const root = projectWith({ 'src/price.ts': '' });

    const [price] = markOutsideMutateScope([changedSource('src/price.ts')], ['src/price.ts:1-20'], root);

    expect(price.isSource).toBe(true);
  });

  it('leaves files untouched when there is no mutate scope', () => {
    const root = projectWith({ 'scripts/build.mjs': '' });

    const [build] = markOutsideMutateScope([changedSource('scripts/build.mjs')], undefined, root);

    expect(build.isSource).toBe(true);
  });
});
