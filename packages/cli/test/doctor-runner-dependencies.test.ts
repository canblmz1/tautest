import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { TestRunner } from '@tautest/core';
import { runDoctorCommand } from '../src/commands/doctor';
import type { DoctorReport } from '../src/lib/doctor';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(runner: TestRunner, plugins: TestRunner[], options: { configured?: TestRunner; core?: boolean; vitest?: string } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'tautest-doctor-runners-'));
  roots.push(root);
  const installed: Record<string, string> = { [runner]: runner === 'vitest' ? options.vitest ?? '4.1.8' : '30.0.0' };
  if (options.core !== false) installed['@stryker-mutator/core'] = '9.6.1';
  for (const plugin of plugins) installed[`@stryker-mutator/${plugin}-runner`] = '9.6.1';
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', packageManager: 'pnpm@10.33.1', devDependencies: installed }));
  for (const [name, version] of Object.entries(installed)) {
    mkdirSync(path.join(root, 'node_modules', name), { recursive: true });
    writeFileSync(path.join(root, 'node_modules', name, 'package.json'), JSON.stringify({ name, version }));
  }
  writeFileSync(path.join(root, runner === 'vitest' ? 'vitest.config.mjs' : 'jest.config.cjs'), runner === 'vitest' ? 'export default {};' : 'module.exports = {};');
  if (options.configured) {
    // Keep the selected runner's config nested so automatic detection stays different.
    mkdirSync(path.join(root, 'test'));
    const configFile = `test/${options.configured}.config.${options.configured === 'vitest' ? 'mjs' : 'cjs'}`;
    writeFileSync(path.join(root, configFile), options.configured === 'vitest' ? 'export default {};' : 'module.exports = {};');
    writeFileSync(path.join(root, 'tautest.config.json'), JSON.stringify({ testRunner: options.configured,
      stryker: { [`${options.configured}ConfigFile`]: configFile } }));
  }
  writeFileSync(path.join(root, '.gitignore'), '.tautest/\n');
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'pipe' });
  return root;
}
async function diagnose(root: string) {
  const command = await runDoctorCommand(root, { json: true });
  const report = JSON.parse(command.output) as DoctorReport;
  return { ...command, report, dependency: report.checks.find(check => check.name === 'Stryker dependencies')!,
    compatibility: report.checks.find(check => check.name === 'Vitest and Stryker runner')! };
}

describe('doctor selected Stryker runner dependency', () => {
  it.each(['vitest', 'jest'] as const)('warns when %s only has the other Stryker runner, without adding a hard error', async runner => {
    const other = runner === 'vitest' ? 'jest' : 'vitest';
    const root = fixture(runner, [other]);
    const result = await diagnose(root);
    expect(result.dependency.status).toBe('warning');
    expect(result.dependency.message).toContain(`@stryker-mutator/${runner}-runner`);
    expect(result.dependency.suggestion).toContain('tautest init');
    expect(result.hasErrors).toBe(false);
    expect(result.report.errors).toEqual([]);
    expect(result.report.warnings).toContainEqual(result.dependency);
    if (runner === 'vitest') expect(result.compatibility.status).toBe('warning');
    expect((await runDoctorCommand(root, {})).output).toContain('WARN Stryker dependencies:');
  });

  it.each(['vitest', 'jest'] as const)('accepts the matching %s runner alone or alongside the other runner', async runner => {
    for (const plugins of [[runner], ['vitest', 'jest']] as TestRunner[][]) {
      const result = await diagnose(fixture(runner, plugins));
      expect(result.dependency.status).toBe('ok');
      expect(result.report.warnings).toEqual([]);
      expect(result.report.errors).toEqual([]);
      expect(result.hasErrors).toBe(false);
    }
  });

  it.each(['vitest', 'jest'] as const)('uses explicitly configured %s instead of detection for all runner checks', async configured => {
    const detected = configured === 'vitest' ? 'jest' : 'vitest';
    const root = fixture(detected, [detected], { configured });
    const result = await diagnose(root);
    expect(result.report.checks.find(check => check.name === 'Test runner')?.message).toMatch(new RegExp(`^${configured}:`));
    expect(result.dependency).toMatchObject({ status: 'warning', message: expect.stringContaining(`@stryker-mutator/${configured}-runner`) });
    expect(result.report.checks.find(check => check.name === 'Runner config')).toMatchObject({ status: 'ok', message: expect.stringContaining(`test${path.sep}${configured}.config`) });
    expect(result.compatibility.status).toBe(configured === 'vitest' ? 'warning' : 'ok');
    expect(result.report.checks.find(check => check.name === 'Jest compatibility')?.message).toContain(configured === 'jest' ? 'Jest detected' : 'Not using Jest');
    expect(result.hasErrors).toBe(false);

    // A configured runner must also be accepted when only its matching plugin exists.
    const matching = await diagnose(fixture(detected, [configured], { configured }));
    expect(matching.dependency.status).toBe('ok');
  });

  it('preserves missing-core and missing-runner warnings and the JSON command contract', async () => {
    for (const options of [{ plugins: [] }, { plugins: ['vitest'] as TestRunner[], core: false }, { plugins: [], core: false }]) {
      const result = await diagnose(fixture('vitest', options.plugins, options));
      expect(result.dependency.status).toBe('warning');
      expect(result.dependency.suggestion).toContain('tautest init');
      expect(result.hasErrors).toBe(false);
      expect(result.report.errors).toEqual([]);
      expect(Object.keys(result.report).sort()).toEqual(['checks', 'cwd', 'errors', 'warnings']);
    }
  });

  it.each(['vitest', '@stryker-mutator/vitest-runner'])('does not claim compatibility when declared %s is not installed', async missing => {
    const root = fixture('vitest', ['vitest']);
    rmSync(path.join(root, 'node_modules', missing), { recursive: true });
    const result = await diagnose(root);
    expect(result.dependency.status).toBe('ok'); // This check concerns package.json declarations.
    expect(result.compatibility).toMatchObject({ status: 'warning', message: expect.stringContaining(missing) });
    expect(result.hasErrors).toBe(false);
  });

  it('does not apply the Vitest 5 error to explicitly selected Jest', async () => {
    const result = await diagnose(fixture('vitest', ['vitest', 'jest'], { configured: 'jest', vitest: '5.0.1' }));
    expect(result.hasErrors).toBe(false);
    expect(result.compatibility).toMatchObject({ status: 'ok', message: 'Not using Vitest.' });
  });

  it('still errors for selected Vitest 5 with the affected installed runner', async () => {
    const result = await diagnose(fixture('vitest', ['vitest'], { vitest: '5.0.1' }));
    expect(result.hasErrors).toBe(true);
    expect(result.compatibility.status).toBe('error');
    expect(result.compatibility.suggestion).toContain('Pin vitest to ^4');
  });

  it('applies the Vitest 5 guard when Vitest is explicitly selected over detected Jest', async () => {
    const root = fixture('jest', ['vitest'], { configured: 'vitest' });
    mkdirSync(path.join(root, 'node_modules/vitest'));
    writeFileSync(path.join(root, 'node_modules/vitest/package.json'), JSON.stringify({ name: 'vitest', version: '5.0.1' }));
    const result = await diagnose(root);
    expect(result.hasErrors).toBe(true);
    expect(result.compatibility.status).toBe('error');
    expect(result.compatibility.suggestion).toContain('Pin vitest to ^4');
  });
});
