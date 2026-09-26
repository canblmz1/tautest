import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runMutationCommand } from '../src/commands/run';
import { gitProject } from './git-project';

// Stryker is the one slow external dependency here. The fake writes what a real run
// writes when the mutate ranges hold no mutable code: an empty `files` object
// (captured from a real run on a comment-and-declaration-only diff).
vi.mock('@tautest/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tautest/core')>();

  return {
    ...actual,
    runStryker: vi.fn(async (options: { jsonReportPath: string }) => {
      mkdirSync(path.dirname(options.jsonReportPath), { recursive: true });
      writeFileSync(options.jsonReportPath, JSON.stringify({ schemaVersion: '2', thresholds: { high: 80, low: 60 }, files: {}, testFiles: {} }));
      const now = new Date();
      return { jsonReportPath: options.jsonReportPath, startedAt: now, endedAt: now };
    })
  };
});

describe('run when the changed lines contain no mutable code', () => {
  it('is a no-op instead of a failed threshold', async () => {
    const root = gitProject({
      'package.json': JSON.stringify({ name: 'no-mutants-fixture', devDependencies: { vitest: '^4.0.0' } }),
      'src/price.js': 'export const price = (amount) => amount;\n'
    });
    writeFileSync(path.join(root, 'src/price.js'), '// Amounts are in cents.\nexport const price = (amount) => amount;\n');

    const result = await runMutationCommand(root, { base: 'HEAD', json: true });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.output)).toMatchObject({ status: 'no-op', mutatePatterns: ['src/price.js:1-1'] });
  });
});
