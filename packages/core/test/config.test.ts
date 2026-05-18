import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TAUTEST_CONFIG } from '../src/config/defaults';
import { defineConfig, findTautestConfig, loadTautestConfig, resolveTautestConfig } from '../src/config/load';
import { tautestConfigSchema } from '../src/config/schema';

describe('config loader', () => {
  it('returns defaults when no config exists', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-config-empty-'));

    await expect(loadTautestConfig(root)).resolves.toEqual(DEFAULT_TAUTEST_CONFIG);
    expect(findTautestConfig(root)).toBeNull();
  });

  it('loads and validates JSON config', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-config-'));
    writeFileSync(
      path.join(root, 'tautest.config.json'),
      JSON.stringify({
        baseRef: 'origin/main',
        rangeCoalesceGap: 2,
        score: {
          strong: 90
        },
        stryker: {
          incremental: true
        }
      })
    );

    await expect(loadTautestConfig(root)).resolves.toMatchObject({
      baseRef: 'origin/main',
      rangeCoalesceGap: 2,
      score: {
        strong: 90,
        mixed: 60
      },
      stryker: {
        incremental: true,
        timeoutMS: 5000
      }
    });
  });

  it('exposes defineConfig helper and schema validation', () => {
    const input = defineConfig({ testRunner: 'vitest', prompt: { maxMutants: 3, style: 'opencode' } });

    expect(resolveTautestConfig(input)).toMatchObject({
      testRunner: 'vitest',
      prompt: {
        maxMutants: 3,
        style: 'opencode'
      }
    });
    expect(() => tautestConfigSchema.parse({ testRunner: 'mocha' })).toThrow();
  });
});
