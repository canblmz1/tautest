import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runDoctorCommand } from '../src/commands/doctor';

function packageExtending(extendsValue: string | string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-doctor-tsconfig-'));
  const app = path.join(root, 'packages', 'app');
  mkdirSync(app, { recursive: true });
  writeFileSync(path.join(root, 'tsconfig.base.json'), '{ "compilerOptions": { "strict": true } }');
  writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'app', devDependencies: { vitest: '^4.0.0' } }));
  writeFileSync(path.join(app, 'tsconfig.json'), JSON.stringify({ extends: extendsValue }));
  return app;
}

async function sandboxTsconfigCheck(root: string) {
  const report = JSON.parse((await runDoctorCommand(root, { json: true })).output) as {
    checks: Array<{ name: string; status: string; message: string; suggestion?: string }>;
  };
  return report.checks.find((check) => check.name === 'Stryker sandbox tsconfig');
}

describe('doctor Stryker sandbox tsconfig check', () => {
  it('accepts a string extends outside the package, which Stryker rewrites', async () => {
    expect(await sandboxTsconfigCheck(packageExtending('../../tsconfig.base.json'))).toMatchObject({ status: 'ok' });
  });

  it('warns, without blocking, about an extends array Stryker leaves pointing outside its sandbox', async () => {
    expect(await sandboxTsconfigCheck(packageExtending(['../../tsconfig.base.json']))).toMatchObject({
      status: 'warning',
      message: expect.stringContaining('`../../tsconfig.base.json`'),
      suggestion: expect.stringContaining('single "extends" string')
    });
  });
});
