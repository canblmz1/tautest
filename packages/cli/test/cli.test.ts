import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildProgram } from '../src/index';
import { runDemoCommand } from '../src/commands/demo';
import { runInit } from '../src/commands/init';
import { runPromptCommand } from '../src/commands/prompt';
import { runReportCommand } from '../src/commands/report';
import { runDoctorCommand } from '../src/commands/doctor';
import {
  assertChangedSourceLineBudget,
  buildDryRunOutput,
  buildNoOpOutput,
  buildWorkspacePlanOutput,
  buildWorkspaceRunOutput,
  countChangedSourceLines,
  resolveWorkspaceCwd
} from '../src/commands/run';

describe('CLI program', () => {
  it('registers expected commands', () => {
    expect(buildProgram().commands.map((command) => command.name())).toEqual(['demo', 'init', 'doctor', 'run', 'prompt', 'report']);
  });

  it('registers workspace planning flags on run', () => {
    const runCommand = buildProgram().commands.find((command) => command.name() === 'run');

    expect(runCommand?.options.map((option) => option.long)).toEqual(
      expect.arrayContaining(['--workspace', '--workspace-path', '--packages', '--affected', '--all'])
    );
  });

  it('uses the package.json version', () => {
    const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { version: string };

    expect(buildProgram().version()).toBe(packageJson.version);
  });
});

describe('demo command', () => {
  it('prints the local passing-tests-but-surviving-mutant demo', async () => {
    const output = await runDemoCommand(process.cwd());

    expect(output).toContain('tests can pass while a changed-line mutant survives');
    expect(output).toContain('examples/vitest-basic');
    expect(output).toContain('age >= 65');
    expect(output).toContain('age > 65');
    expect(output).toContain('tautest demo --run');
    expect(output).toContain('Create a tiny production diff');
    expect(output).toContain('pnpm --dir examples/vitest-basic exec tautest run --base HEAD --threshold 80 --prompt-style codex || true');
  });

  it('prints machine-readable demo metadata', async () => {
    const output = JSON.parse(await runDemoCommand(process.cwd(), { json: true })) as {
      example: string;
      mutant: {
        original: string;
        replacement: string;
      };
    };

    expect(output.example).toBe('examples/vitest-basic');
    expect(output.mutant.original).toBe('age >= 65');
    expect(output.mutant.replacement).toBe('age > 65');
  });

  it('runs the repository demo fixture and restores temporary edits', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-demo-run-'));
    const fixtureRoot = path.join(root, 'examples', 'vitest-basic', 'src');
    const sourcePath = path.join(fixtureRoot, 'discount.ts');
    const testPath = path.join(fixtureRoot, 'discount.test.ts');
    const source = `export function calculateDiscount(age: number, subtotal: number): number {
  if (age >= 65) {
    return subtotal * 0.2;
  }

  if (subtotal >= 100) {
    return subtotal * 0.1;
  }

  return 0;
}
`;
    const test = `import { describe, expect, it } from 'vitest';
import { calculateDiscount } from './discount';

describe('calculateDiscount', () => {
  it('applies the senior discount for customers above 65', () => {
    expect(calculateDiscount(70, 100)).toBe(20);
  });

  it('applies the subtotal discount at 100', () => {
    expect(calculateDiscount(30, 100)).toBe(10);
  });
});
`;
    const commands: string[] = [];

    mkdirSync(fixtureRoot, { recursive: true });
    writeFileSync(sourcePath, source);
    writeFileSync(testPath, test);

    const output = await runDemoCommand(
      root,
      { run: true },
      (command, args) => {
        commands.push([command, ...args].join(' '));
        if (command === 'git') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        return { exitCode: 0, stdout: `${command} ok\n`, stderr: '' };
      }
    );

    expect(output).toContain('Tautest demo run completed');
    expect(output).toContain('Working tree restored: yes');
    expect(commands).toContain('git status --porcelain -- examples/vitest-basic/src/discount.ts examples/vitest-basic/src/discount.test.ts');
    expect(commands).toContain('pnpm --dir examples/vitest-basic test');
    expect(commands).toContain('pnpm --dir examples/vitest-basic exec tautest run --base HEAD --threshold 80 --prompt-style codex');
    expect(readFileSync(sourcePath, 'utf8')).toBe(source);
    expect(readFileSync(testPath, 'utf8')).toBe(test);
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
    expect(output).toContain('Changed production lines: 1');
    expect(output).toContain('Changed production files:');
    expect(output).toContain('- src/discount.ts lines 2 (1 changed line)');
    expect(output).toContain('Excluded changed files:');
    expect(output).toContain('- src/discount.test.ts: test file');
    expect(output).toContain('- README.md: non-source file');
  });
});

describe('no-op output', () => {
  it('explains why changed files were not mutated', () => {
    const output = buildNoOpOutput({
      baseRef: 'origin/main',
      runner: 'vitest',
      reportDir: '.tautest',
      json: false,
      changedFiles: [
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
      ]
    });

    expect(output).toContain('Tautest no-op');
    expect(output).toContain('Changed files inspected: 2');
    expect(output).toContain('- src/discount.test.ts: test file');
    expect(output).toContain('- README.md: non-source file');
    expect(output).toContain('Changed tests are not mutated by Tautest');
    expect(output).toContain('add its extension to sourceFileExtensions');
  });

  it('prints machine-readable no-op guidance', () => {
    const output = JSON.parse(
      buildNoOpOutput({
        baseRef: 'HEAD',
        runner: 'vitest',
        reportDir: '.tautest',
        json: true,
        changedFiles: []
      })
    ) as {
      status: string;
      changedFiles: unknown[];
      guidance: string[];
    };

    expect(output.status).toBe('no-op');
    expect(output.changedFiles).toEqual([]);
    expect(output.guidance[0]).toContain('No changed files were found');
  });
});

describe('mutation budget helpers', () => {
  it('counts changed source lines across ranges and files', () => {
    const files = [
      {
        path: 'src/discount.ts',
        status: 'modified' as const,
        ranges: [
          { start: 2, end: 4 },
          { start: 9, end: 9 }
        ],
        isSource: true,
        isTest: false,
        isBinary: false,
        warnings: []
      },
      {
        path: 'src/tax.ts',
        status: 'modified' as const,
        ranges: [{ start: 1, end: 2 }],
        isSource: true,
        isTest: false,
        isBinary: false,
        warnings: []
      }
    ];

    expect(countChangedSourceLines(files)).toBe(6);
  });

  it('rejects changed source line budgets before mutation runs', () => {
    expect(() =>
      assertChangedSourceLineBudget(
        [
          {
            path: 'src/discount.ts',
            status: 'modified',
            ranges: [
              { start: 2, end: 4 },
              { start: 9, end: 9 }
            ],
            isSource: true,
            isTest: false,
            isBinary: false,
            warnings: []
          }
        ],
        1
      )
    ).toThrow('--max-changed-lines 1');
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

describe('workspace plan output', () => {
  it('prints machine-readable selected package plans', () => {
    const output = JSON.parse(
      buildWorkspacePlanOutput({
        baseRef: 'origin/main',
        reportDir: '.tautest',
        json: true,
        plan: {
          mode: 'affected',
          workspace: {
            detected: true,
            rootDir: '/repo',
            source: 'pnpm-workspace.yaml',
            packageManager: 'pnpm',
            patterns: ['packages/*'],
            packages: [],
            tools: [],
            confidence: 'high',
            warnings: []
          },
          changedFiles: [
            {
              path: 'packages/api/src/index.ts',
              status: 'modified',
              ranges: [{ start: 1, end: 1 }],
              isSource: true,
              isTest: false,
              isBinary: false,
              warnings: []
            }
          ],
          selectedPackages: [
            {
              name: '@fixture/api',
              path: 'packages/api',
              absolutePath: '/repo/packages/api',
              packageJsonPath: '/repo/packages/api/package.json',
              packageJson: { name: '@fixture/api' },
              selected: true,
              reasons: ['changed packages/api/src/index.ts']
            }
          ],
          unselectedPackages: [],
          warnings: []
        }
      })
    ) as {
      status: string;
      mode: string;
      selectedPackages: Array<{ name: string; path: string; reasons: string[] }>;
    };

    expect(output.status).toBe('workspace-plan');
    expect(output.mode).toBe('affected');
    expect(output.selectedPackages).toEqual([
      {
        name: '@fixture/api',
        path: 'packages/api',
        reasons: ['changed packages/api/src/index.ts']
      }
    ]);
  });

  it('prints machine-readable aggregate workspace run output', () => {
    const output = JSON.parse(
      buildWorkspaceRunOutput({
        json: true,
        reportPath: '/repo/.tautest/workspace-report.md',
        jsonReportPath: '/repo/.tautest/workspace-report.json',
        report: {
          version: '1',
          schemaVersion: '1',
          createdAt: '2026-05-25T00:00:00.000Z',
          status: 'workspace-threshold-failed',
          baseRef: 'origin/main',
          packageManager: 'pnpm',
          workspaceRoot: '/repo',
          reportDir: '/repo/.tautest',
          summary: {
            selected: 1,
            passed: 0,
            thresholdFailed: 1,
            noOp: 0,
            errors: 0
          },
          packages: [
            {
              name: '@fixture/api',
              path: 'packages/api',
              status: 'threshold-failed',
              exitCode: 1,
              reasons: ['changed packages/api/src/index.ts']
            }
          ],
          warnings: []
        }
      })
    ) as {
      status: string;
      paths: { report: string; json: string };
    };

    expect(output.status).toBe('workspace-threshold-failed');
    expect(output.paths.json).toBe('/repo/.tautest/workspace-report.json');
  });
});

describe('doctor command', () => {
  it('reports tested Jest compatibility paths', async () => {
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

    const result = await runDoctorCommand(root, { json: false });

    expect(result.output).toContain('OK Jest compatibility: Jest detected.');
    expect(result.output).toContain('Use stryker.jestConfigFile');
  });

  it('warns about TypeScript Jest config files', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-cli-jest-ts-config-'));
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'jest-ts-config-fixture',
        devDependencies: {
          jest: '^30.0.0',
          '@stryker-mutator/core': '^9.6.1',
          '@stryker-mutator/jest-runner': '^9.6.1'
        }
      })
    );
    writeFileSync(path.join(root, 'jest.config.ts'), 'export default {};');
    writeFileSync(path.join(root, '.gitignore'), '.tautest/\n');

    const result = await runDoctorCommand(root, { json: false });

    expect(result.output).toContain('WARN Jest compatibility: Jest was detected with a TypeScript Jest config file.');
  });
});
