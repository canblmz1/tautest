import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { reviewHash } from '@tautest/core';

const { execute } = vi.hoisted(() => ({
  execute: vi.fn<(input: { config: Record<string, unknown> }) => Promise<void>>(async () => undefined)
}));
vi.mock('@tautest/core', async importOriginal => ({
  ...await importOriginal<typeof import('@tautest/core')>(), runStryker: execute
}));
const roots: string[] = [];
const argv = [...process.argv];
afterEach(() => {
  process.argv = [...argv];
  execute.mockClear();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function worker(config: Record<string, unknown> | undefined, runner?: string, reportRunner = 'vitest') {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-worker-config-'));
  roots.push(root);
  mkdirSync(path.join(root, 'out'));
  const source = 'export const eligible = age => age >= 18;\n';
  const candidate = '// candidate boundary assertion\n';
  writeFileSync(path.join(root, 'eligible.js'), source);
  writeFileSync(path.join(root, 'boundary.test.js'), candidate);
  if (config) writeFileSync(path.join(root, 'stryker.config.json'), JSON.stringify(config));
  writeFileSync(path.join(root, 'request.json'), JSON.stringify({ root, sourceFile: 'eligible.js', source,
    testFile: 'boundary.test.js', testHash: reviewHash(candidate), startLine: 1, endLine: 1,
    runner, reportRunner, output: path.join(root, 'out') }));
  process.argv[2] = path.join(root, 'request.json');
  vi.resetModules();
  await import('../src/stryker-worker');
  await vi.waitFor(() => expect(existsSync(path.join(root, 'out/completed.json'))).toBe(true));
  return execute.mock.calls[0]?.[0];
}

describe('verification worker runner plugins', () => {
  it.each(['vitest', 'jest'])('explicitly loads the selected %s runner without a Stryker config', async runner => {
    const request = await worker(undefined, runner);
    expect(request?.config).toMatchObject({ testRunner: runner, appendPlugins: [`@stryker-mutator/${runner}-runner`] });
    expect(request?.config).not.toHaveProperty('plugins');
  });

  it('loads the runner recorded in the report when none is configured or specified', async () => {
    expect((await worker(undefined))?.config.appendPlugins).toEqual(['@stryker-mutator/vitest-runner']);
  });

  it('uses explicit runner selection ahead of local config and the report', async () => {
    expect((await worker({ testRunner: 'jest' }, 'vitest', 'jest'))?.config).toMatchObject({
      testRunner: 'vitest', appendPlugins: ['@stryker-mutator/vitest-runner']
    });
  });

  it('uses local runner selection ahead of the report', async () => {
    expect((await worker({ testRunner: 'jest' }))?.config).toMatchObject({
      testRunner: 'jest', appendPlugins: ['@stryker-mutator/jest-runner']
    });
  });

  it.each([{ plugins: ['./custom-runner.mjs'] }, { plugins: [] }])('preserves explicit plugins %j and appended plugins', async ({ plugins }) => {
    const request = await worker({ plugins, appendPlugins: ['./extra-plugin.mjs'], concurrency: 1 }, 'vitest');
    expect(request?.config).toMatchObject({ plugins, appendPlugins: ['./extra-plugin.mjs'], concurrency: 1,
      incremental: false, inPlace: false, mutate: ['eligible.js:1-1'] });
  });

  it('does not invent a package for a custom runner', async () => {
    expect((await worker({ testRunner: 'command' }))?.config).not.toHaveProperty('appendPlugins');
  });

  it('keeps default checker discovery and previously appended plugins', async () => {
    const request = await worker({ checkers: ['typescript'], appendPlugins: ['./extra-plugin.mjs'] }, 'vitest');
    expect(request?.config).not.toHaveProperty('plugins');
    expect(request?.config).toMatchObject({ checkers: ['typescript'],
      appendPlugins: ['./extra-plugin.mjs', '@stryker-mutator/vitest-runner'] });
  });

  it('does not append the same selected runner twice', async () => {
    expect((await worker({ appendPlugins: ['@stryker-mutator/vitest-runner'] }))?.config.appendPlugins)
      .toEqual(['@stryker-mutator/vitest-runner']);
  });

  it('leaves invalid appended plugin options for Stryker to reject', async () => {
    expect((await worker({ appendPlugins: 'invalid' }))?.config.appendPlugins).toBe('invalid');
  });
});
