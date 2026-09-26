import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDoctorCommand } from '../src/commands/doctor';

function projectWith(installed: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-doctor-vitest-'));
  const devDependencies = Object.fromEntries(Object.keys(installed).map((name) => [name, '*']));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', devDependencies }));

  for (const [name, version] of Object.entries(installed)) {
    mkdirSync(path.join(root, 'node_modules', name), { recursive: true });
    writeFileSync(path.join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  }

  return root;
}

async function vitestRunnerCheck(root: string) {
  const report = JSON.parse((await runDoctorCommand(root, { json: true })).output) as {
    checks: Array<{ name: string; status: string; suggestion?: string }>;
  };
  return report.checks.find((check) => check.name === 'Vitest and Stryker runner');
}

describe('doctor Vitest and Stryker runner check', () => {
  it('flags Vitest 5 with a Stryker Vitest runner that runs no tests on it', async () => {
    const root = projectWith({ vitest: '5.0.1', '@stryker-mutator/core': '10.0.0', '@stryker-mutator/vitest-runner': '10.0.0' });

    expect(await vitestRunnerCheck(root)).toMatchObject({
      status: 'error',
      suggestion: 'Pin vitest to ^4 until the Stryker Vitest runner supports Vitest 5.'
    });
  });

  it('accepts Vitest 4 with the same runner', async () => {
    const root = projectWith({ vitest: '4.1.11', '@stryker-mutator/core': '10.0.0', '@stryker-mutator/vitest-runner': '10.0.0' });

    expect((await vitestRunnerCheck(root))?.status).toBe('ok');
  });
});
