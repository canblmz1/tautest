import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildProgram } from '../src/index';
import { runInit } from '../src/commands/init';
import { runPromptCommand } from '../src/commands/prompt';
import { runReportCommand } from '../src/commands/report';
import { runDoctorCommand } from '../src/commands/doctor';
import { buildDryRunOutput, resolveWorkspaceCwd } from '../src/commands/run';

describe('CLI program', () => {
  it('registers expected commands', () => {
    expect(buildProgram().commands.map((command) => command.name())).toEqual(['init', 'doctor', 'run', 'prompt', 'report']);
  });
});

describe('init command', () => {
  it('creates config, gitignore entry, and Stryker dev dependencies without installing', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-cli-init-'));
    const packageJsonPath = path.join(root, 'package.json');
    writeFileSync(
      packageJsonPath,
      JSON.stringify({
        name: 'fixture',
        type: 'module',
        devDependencies: {
          vitest: '^3.0.0'
        }
      })
    );
    writeFileSync(path.join(root, 'vitest.config.ts'), '');

    const result = await runInit(root, { noInstall: true, runner: 'vitest', pm: 'pnpm', yes: true });

    expect(result).toMatchObject({
      runner: 'vitest',
      packageManager: 'pnpm',
      installed: false
    });
    await expect(readFile(path.join(root, 'tautest.config.ts'), 'utf8')).resolves.toContain("testRunner: 'vitest'");
    await expect(readFile(path.join(root, '.gitignore'), 'utf8')).resolves.toContain('.tautest/');
    await expect(readFile(packageJsonPath, 'utf8')).resolves.toContain('@stryker-mutator/vitest-runner');
  });
});

describe('prompt and report commands', () => {
  it('prints prompt and markdown report from generated files', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-cli-output-'));
    const outputDir = path.join(root, '.tautest');
    mkdirSync(outputDir);
    writeFileSync(
      path.join(outputDir, 'report.json'),
      JSON.stringify({
        version: '1',
        scope: {
          baseRef: 'HEAD',
          runner: 'vitest'
        },
        aiSignals: {
          promptStyle: 'codex',
          commands: ['tautest run --base HEAD', 'vitest run']
        },
        surviving: [
          {
            filePath: 'src/discount.ts',
            line: 2,
            mutatorName: 'EqualityOperator',
            original: 'age >= 65',
            replacement: 'age > 65',
            status: 'Survived',
            location: {
              start: { line: 2, column: 7 },
              end: { line: 2, column: 16 }
            }
          }
        ]
      })
    );
    writeFileSync(path.join(outputDir, 'report.md'), '# Report\n');

    expect(runPromptCommand(root, {})).toContain('Do not change production code.');
    expect(runPromptCommand(root, {})).toContain('You are Codex working in the current workspace.');
    expect(runPromptCommand(root, { style: 'human' })).toContain('Use this as a human test-writing checklist.');
    expect(runPromptCommand(root, { style: 'opencode' })).toContain('You are OpenCode working in an existing repository.');
    expect(runReportCommand(root, {})).toBe('# Report\n');
  });
});

describe('dry-run output', () => {
  it('explains included and excluded changed files', () => {
    const output = buildDryRunOutput({
      baseRef: 'origin/main',
      runner: 'vitest',
      reportDir: '.tautest',
      mutatePatterns: ['src/discount.ts:2-2'],
      json: false,
      changedFiles: [
        {
          path: 'src/discount.ts',
          status: 'modified',
          ranges: [{ start: 2, end: 2 }],
          isSource: true,
          isTest: false,
          isBinary: false,
          warnings: []
        },
        {
          path: 'src/discount.test.ts',
          status: 'modified',
          ranges: [{ start: 8, end: 10 }],
          isSource: false,
          isTest: true,
          isBinary: false,
          warnings: []
        },
        {
          path: 'README.md',
          status: 'modified',
          ranges: [{ start: 1, end: 1 }],
          isSource: false,
          isTest: false,
          isBinary: false,
          warnings: []
        }
      ],
      sourceFiles: [
        {
          path: 'src/discount.ts',
          status: 'modified',
          ranges: [{ start: 2, end: 2 }],
          isSource: true,
          isTest: false,
          isBinary: false,
          warnings: []
        }
      ]
    });

    expect(output).toContain('Estimated mutation scope: small');
    expect(output).toContain('Changed production files:');
    expect(output).toContain('- src/discount.ts lines 2 (1 changed line)');
    expect(output).toContain('Excluded changed files:');
    expect(output).toContain('- src/discount.test.ts: test file');
    expect(output).toContain('- README.md: non-source file');
  });
});

describe('workspace path resolution', () => {
  it('resolves workspace paths inside the current directory', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-workspace-'));
    const workspace = path.join(root, 'packages', 'api');
    mkdirSync(workspace, { recursive: true });

    expect(resolveWorkspaceCwd(root, 'packages/api')).toBe(workspace);
  });

  it('rejects workspace paths outside the current directory', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-workspace-'));

    expect(() => resolveWorkspaceCwd(root, '..')).toThrow('--workspace must stay inside');
  });
});

describe('doctor command', () => {
  it('warns that Jest support is beta', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-cli-jest-'));
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'jest-fixture',
        devDependencies: {
          jest: '^30.0.0',
          '@stryker-mutator/core': '^9.6.1',
          '@stryker-mutator/jest-runner': '^9.6.1'
        }
      })
    );
    writeFileSync(path.join(root, 'jest.config.cjs'), 'module.exports = {};');
    writeFileSync(path.join(root, '.gitignore'), '.tautest/\n');

    const result = runDoctorCommand(root, { json: false });

    expect(result.output).toContain('WARN Jest beta: Jest support is beta.');
  });
});
