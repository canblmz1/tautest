import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectAiAuthor } from '../src/detect/ai-author';
import { detectPackageManager, parsePackageManagerField } from '../src/detect/package-manager';
import { detectMonorepoSignals, detectProject } from '../src/detect/project';
import { detectTestRunnerFromSignals } from '../src/detect/test-runner';

describe('package manager detector', () => {
  it('prefers packageManager field', () => {
    expect(detectPackageManager('unused', { packageManager: 'pnpm@10.33.1' }).packageManager).toBe('pnpm');
    expect(parsePackageManagerField('bun@1.2.0')).toBe('bun');
  });

  it('falls back to lockfiles', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-pm-'));
    writeFileSync(path.join(root, 'yarn.lock'), '');

    expect(detectPackageManager(root, {}).packageManager).toBe('yarn');
  });

  it('uses parent package manager metadata for workspace packages', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-pm-parent-'));
    const workspacePackage = path.join(root, 'packages', 'app');
    mkdirSync(workspacePackage, { recursive: true });
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.1' }));

    expect(detectPackageManager(workspacePackage, {}).packageManager).toBe('pnpm');
  });
});

describe('test runner detector', () => {
  it('defaults to Vitest when both Vitest and Jest are present', () => {
    expect(
      detectTestRunnerFromSignals({
        packageJson: {
          devDependencies: {
            vitest: '^3.0.0',
            jest: '^30.0.0'
          }
        },
        vitestConfigFiles: ['vitest.config.ts'],
        jestConfigFiles: ['jest.config.js']
      })
    ).toMatchObject({
      runner: 'vitest',
      candidates: ['vitest', 'jest']
    });
  });

  it('returns null with a reason when no runner is present', () => {
    expect(detectTestRunnerFromSignals({ packageJson: {} })).toMatchObject({
      runner: null,
      reason: 'No Vitest or Jest dependency/configuration was detected.'
    });
  });
});

describe('project detector', () => {
  it('detects package, configs, monorepo signals, and tsconfig paths', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-project-'));
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        workspaces: ['packages/*'],
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^3.0.0'
        }
      })
    );
    writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    writeFileSync(path.join(root, 'vitest.config.ts'), '');
    writeFileSync(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@app/*': ['src/*']
          }
        }
      })
    );

    expect(detectProject(path.join(root, 'src'))).toMatchObject({
      rootDir: root,
      hasTypeScript: true,
      monorepo: {
        detected: true,
        signals: ['package.json workspaces', 'pnpm-workspace.yaml']
      },
      tsconfig: {
        baseUrl: '.',
        paths: {
          '@app/*': ['src/*']
        }
      }
    });
  });

  // tsconfig.json is JSON with comments: `tsc --init` writes one full of them, and
  // crutchcorn/cli-testing-library's root tsconfig has `// TODO enable`. Plain JSON.parse made
  // Tautest exit 11 before Stryker ran on such projects.
  it('reads a tsconfig with comments and trailing commas without touching // inside strings', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-tsconfig-jsonc-'));
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { typescript: '^5.0.0' } }));
    writeFileSync(
      path.join(root, 'tsconfig.json'),
      [
        '{',
        '  "$schema": "https://json.schemastore.org/tsconfig", // a URL, then a comment',
        '  /* block comment',
        '     spanning lines */',
        '  "compilerOptions": {',
        '    "baseUrl": "./src/*/not-a-comment",',
        '    "paths": { "@app/*": ["src/*",], "@odd/*": ["lib/,]\\"/*",] },',
        '    "noUnusedLocals": false, // TODO enable',
        '  },',
        '}'
      ].join('\n')
    );

    expect(detectProject(root).tsconfig).toEqual({
      path: path.join(root, 'tsconfig.json'),
      baseUrl: './src/*/not-a-comment',
      paths: { '@app/*': ['src/*'], '@odd/*': ['lib/,]"/*'] },
      unrewrittenExtends: []
    });
  });

  it('keeps going without path hints when tsconfig cannot be parsed at all', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-tsconfig-broken-'));
    writeFileSync(path.join(root, 'package.json'), '{}');
    writeFileSync(path.join(root, 'tsconfig.json'), '{ "compilerOptions": { "baseUrl": ');

    expect(detectProject(root)).toMatchObject({
      hasTypeScript: true,
      tsconfig: { path: path.join(root, 'tsconfig.json'), baseUrl: undefined, paths: undefined }
    });
  });

  it('exposes monorepo detection as warn-level signals', () => {
    expect(detectMonorepoSignals('unused', { workspaces: ['packages/*'] })).toEqual(['package.json workspaces']);
  });

  it('detects ancestor monorepo signals without changing the package root', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-workspace-'));
    const app = path.join(root, 'examples', 'app');
    mkdirSync(app, { recursive: true });
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ workspaces: ['examples/*'] }));
    writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - examples/*\n');
    writeFileSync(path.join(app, 'package.json'), JSON.stringify({ devDependencies: { vitest: '^3.0.0' } }));

    const project = detectProject(app);

    expect(project.rootDir).toBe(app);
    expect(project.monorepo.detected).toBe(true);
    expect(project.monorepo.signals).toEqual([
      `ancestor package.json workspaces at ${root}`,
      `ancestor pnpm-workspace.yaml at ${root}`
    ]);
  });
});

// Stryker's sandbox copy rewrites a string `extends` that leaves the package, but not an array
// entry, nor a file it can only find by appending `.json`.
describe('tsconfig paths Stryker cannot rewrite for its sandbox', () => {
  function packageIn(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-tsconfig-rewrite-'));
    const all = { 'tsconfig.base.json': '{}', 'packages/app/package.json': '{ "name": "app" }', ...files };
    for (const [file, content] of Object.entries(all)) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), content);
    }
    return path.join(root, 'packages', 'app');
  }

  it('accepts a string extends outside the package, which Stryker rewrites', () => {
    const app = packageIn({ 'packages/app/tsconfig.json': '{\n  // shared options\n  "extends": "../../tsconfig.base.json",\n}' });
    expect(detectProject(app).tsconfig.unrewrittenExtends).toEqual([]);
  });

  it('flags an extends array entry outside the package', () => {
    const app = packageIn({
      'packages/app/tsconfig.json': '{ "extends": ["../../tsconfig.base.json", "./local.json"] }',
      'packages/app/local.json': '{}'
    });
    expect(detectProject(app).tsconfig.unrewrittenExtends).toEqual(['../../tsconfig.base.json']);
  });

  it('follows an in-package string chain the way Stryker does', () => {
    const app = packageIn({
      'packages/app/tsconfig.json': '{ "extends": "./tsconfig.build.json" }',
      'packages/app/tsconfig.build.json': '{ "extends": "../../tsconfig.base.json" }'
    });
    expect(detectProject(app).tsconfig.unrewrittenExtends).toEqual([]);
  });

  it('flags an outside path behind an in-package file named without .json, which Stryker cannot find', () => {
    const app = packageIn({
      'packages/app/tsconfig.json': '{ "extends": "./tsconfig.build" }',
      'packages/app/tsconfig.build.json': '{ "extends": "../../tsconfig.base.json" }'
    });
    expect(detectProject(app).tsconfig.unrewrittenExtends).toEqual(['../../tsconfig.base.json']);
  });

  it('flags an outside path behind an in-package array entry', () => {
    const app = packageIn({
      'packages/app/tsconfig.json': '{ "extends": ["./tsconfig.build.json"] }',
      'packages/app/tsconfig.build.json': '{ "extends": "../../tsconfig.base.json" }'
    });
    expect(detectProject(app).tsconfig.unrewrittenExtends).toEqual(['../../tsconfig.base.json']);
  });

  it('ignores package-name and absolute entries, which resolve the same from the sandbox', () => {
    const app = packageIn({ 'packages/app/tsconfig.json': JSON.stringify({ extends: ['@tsconfig/node22/tsconfig.json', path.resolve('/abs/tsconfig.json')] }) });
    expect(detectProject(app).tsconfig.unrewrittenExtends).toEqual([]);
  });
});

describe('AI author detector', () => {
  it('detects Codex, Cursor, Claude, and unknown environment signals', () => {
    expect(detectAiAuthor({ CODEX_HOME: '/tmp/codex' }).author).toBe('codex');
    expect(detectAiAuthor({ CURSOR_TRACE_ID: 'trace' }).author).toBe('cursor');
    expect(detectAiAuthor({ CLAUDE_CODE: '1' }).author).toBe('claude');
    expect(detectAiAuthor({}).author).toBe('unknown');
  });
});

describe('Jest test runner detection', () => {
  it('detects Jest CJS from jest.config.cjs and jest dependency', () => {
    expect(
      detectTestRunnerFromSignals({
        packageJson: {
          devDependencies: {
            jest: '^30.0.0'
          }
        },
        jestConfigFiles: ['jest.config.cjs'],
        vitestConfigFiles: []
      })
    ).toMatchObject({
      runner: 'jest',
      configFile: 'jest.config.cjs'
    });
  });

  it('detects Jest ESM from jest.config.mjs', () => {
    expect(
      detectTestRunnerFromSignals({
        packageJson: {
          devDependencies: {
            jest: '^30.0.0'
          }
        },
        jestConfigFiles: ['jest.config.mjs'],
        vitestConfigFiles: []
      })
    ).toMatchObject({
      runner: 'jest',
      configFile: 'jest.config.mjs'
    });
  });

  it('detects Jest TypeScript from jest.config.ts', () => {
    expect(
      detectTestRunnerFromSignals({
        packageJson: {
          devDependencies: {
            jest: '^30.0.0',
            'ts-jest': '^30.0.0'
          }
        },
        jestConfigFiles: ['jest.config.ts'],
        vitestConfigFiles: []
      })
    ).toMatchObject({
      runner: 'jest',
      configFile: 'jest.config.ts',
      candidates: ['jest']
    });
  });

  it('prefers Vitest over Jest when both config files are present', () => {
    expect(
      detectTestRunnerFromSignals({
        packageJson: {
          devDependencies: {
            vitest: '^3.0.0',
            jest: '^30.0.0'
          }
        },
        jestConfigFiles: ['jest.config.js'],
        vitestConfigFiles: ['vitest.config.ts']
      })
    ).toMatchObject({
      runner: 'vitest',
      candidates: ['vitest', 'jest']
    });
  });
});
