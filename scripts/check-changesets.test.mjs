import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkChangesets } from './check-changesets.mjs';

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function write(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}
function commit(root, message) {
  git(root, 'add', '--all');
  git(root, 'commit', '-m', message);
  return git(root, 'rev-parse', 'HEAD');
}
const packages = ['core', 'cli'];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'changeset-gate-test-'));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Fixture');
  git(root, 'config', 'user.email', 'fixture@example.invalid');
  git(root, 'config', 'core.filemode', 'true');
  write(root, '.gitignore', 'node_modules/\n');
  write(root, 'package.json', '{"private":true,"scripts":{"version-packages":"do not run this script"}}\n');
  write(root, 'pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
  write(root, '.changeset/config.json', '{"baseBranch":"main"}\n');
  write(root, '.changeset/README.md', '# Changesets\n');
  for (const name of ['first', 'second']) write(root, `.changeset/${name}.md`, '---\n"@tautest/core": patch\n"tautest": patch\n---\n\nFix.\n');
  for (const pkg of packages) {
    write(root, `packages/${pkg}/package.json`, JSON.stringify({ name: pkg === 'core' ? '@tautest/core' : 'tautest', version: '2.0.5' }) + '\n');
    write(root, `packages/${pkg}/CHANGELOG.md`, `# ${pkg}\n\n## 2.0.5\n\nOld entry.\n`);
    write(root, `packages/${pkg}/src/index.js`, 'export const unchanged = true;\n');
  }
  const base = commit(root, 'base');
  return { root, base, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
function versionFixture(root) {
  for (const name of ['first', 'second']) rmSync(path.join(root, `.changeset/${name}.md`));
  for (const pkg of packages) {
    const file = `packages/${pkg}/package.json`;
    const data = JSON.parse(readFileSync(path.join(root, file), 'utf8'));
    data.version = '2.0.6';
    write(root, file, JSON.stringify(data) + '\n');
    write(root, `packages/${pkg}/CHANGELOG.md`, `# ${pkg}\n\n## 2.0.6\n\nFix.\n\n## 2.0.5\n\nOld entry.\n`);
  }
}
function validate(f, options = {}) {
  return checkChangesets({ root: f.root, baseRef: f.base,
    status: () => assert.fail('a consumed-changeset candidate must not fall back to status'),
    version: (_root, worktree) => versionFixture(worktree), log: () => {}, ...options });
}
function assertCleanWorktrees(f) {
  assert.equal(git(f.root, 'worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree ')).length, 1);
  assert.equal(git(f.root, 'status', '--porcelain'), '');
}

test('an exact replay accepts consumed changesets without requiring a new one', () => {
  const f = fixture();
  try {
    versionFixture(f.root);
    commit(f.root, 'version');
    assert.equal(validate(f), 'version');
    assert.equal(git(f.root, 'ls-tree', '-r', '--name-only', 'HEAD', '.changeset'), '.changeset/README.md\n.changeset/config.json');
    assertCleanWorktrees(f);
  } finally { f.cleanup(); }
});

test('contributor changes still run the original gate with the resolved base and propagate failure', () => {
  const f = fixture();
  try {
    write(f.root, 'packages/core/src/index.js', 'export const changed = true;\n');
    commit(f.root, 'ordinary contributor change');
    let calls = 0;
    const status = (root, base) => { calls++; assert.equal(root, f.root); assert.equal(base, f.base); };
    assert.equal(validate(f, { status, version: () => assert.fail('must not replay') }), 'contributor');
    assert.equal(calls, 1);
    assert.throws(() => validate(f, { status: () => { throw new Error('missing changeset'); } }), /missing changeset/);
  } finally { f.cleanup(); }
});

test('preflight needs no dependencies and never calls contributor status or versioning', () => {
  const f = fixture();
  try {
    const options = { preflight: true, status: () => assert.fail('must not run status before install'),
      version: () => assert.fail('must not run version before install') };
    assert.equal(validate(f, options), 'contributor');
    versionFixture(f.root); commit(f.root, 'version');
    assert.equal(validate(f, options), 'version');
    const script = fileURLToPath(new URL('./check-changesets.mjs', import.meta.url));
    const output = execFileSync(process.execPath, [script, '--preflight', f.base], { cwd: f.root, encoding: 'utf8' });
    assert.match(output, /preflight passed/);
    assertCleanWorktrees(f);
  } finally { f.cleanup(); }
});

for (const [name, content] of [
  ['lifecycle script', { scripts: { postinstall: 'must never execute' } }],
  ['dependency', { dependencies: { '@tautest/core': 'other-version' } }],
  ['extra field', { unexpected: true }],
  ['package identity', { name: 'different-package' }],
  ['license', { license: 'different-license' }]
]) {
  test(`rejects a manifest ${name} before any install or replay can run`, () => {
    for (const pkg of packages) {
      const f = fixture();
      try {
        versionFixture(f.root);
        const file = `packages/${pkg}/package.json`;
        const data = JSON.parse(readFileSync(path.join(f.root, file), 'utf8'));
        write(f.root, file, JSON.stringify({ ...data, ...content }) + '\n');
        commit(f.root, name);
        for (const preflight of [true, false]) {
          assert.throws(() => validate(f, { preflight,
            version: () => assert.fail('must reject before replay') }), /may change only version/);
        }
        assertCleanWorktrees(f);
      } finally { f.cleanup(); }
    }
  });
}

for (const [name, content] of [
  ['malformed JSON', '{'], ['null', 'null'], ['array', '[]'],
  ['non-string version', '{"name":"tautest","version":206}'],
  ['prerelease version', '{"name":"tautest","version":"2.0.6-beta.0"}']
]) {
  test(`preflight rejects a manifest with ${name}`, () => {
    const f = fixture();
    try {
      versionFixture(f.root); write(f.root, 'packages/cli/package.json', content); commit(f.root, name);
      assert.throws(() => validate(f, { preflight: true, version: () => assert.fail('must not replay') }));
    } finally { f.cleanup(); }
  });
}

test('a branch named changeset-release/main cannot bypass the contributor gate', () => {
  const f = fixture();
  try {
    git(f.root, 'checkout', '-b', 'changeset-release/main');
    write(f.root, 'packages/core/src/index.js', 'unversioned change\n');
    commit(f.root, 'chore: version packages');
    assert.throws(() => validate(f, { status: () => { throw new Error('missing changeset'); } }), /missing changeset/);
  } finally { f.cleanup(); }
});

const forbidden = [
  ['source', 'packages/core/src/index.js', 'changed\n'],
  ['lockfile', 'pnpm-lock.yaml', 'unexpected dependency update\n'],
  ['root version command', 'package.json', '{"scripts":{"version-packages":"changed"}}\n'],
  ['Changesets config', '.changeset/config.json', '{"ignore":["tautest"]}\n'],
  ['workflow', '.github/workflows/release.yml', 'changed\n'],
  ['Changesets README', '.changeset/README.md', 'changed\n'],
  ['new empty changeset', '.changeset/another.md', '---\n---\n'],
  ['private package', 'packages/github-action/package.json', '{"version":"2.0.6"}\n']
];
for (const [name, file, content] of forbidden) {
  test(`rejects ${name} changes before executing versioning`, () => {
    const f = fixture();
    try {
      versionFixture(f.root); write(f.root, file, content); commit(f.root, name);
      assert.throws(() => validate(f, { version: () => assert.fail('must reject before replay') }), /unexpected change/);
      assertCleanWorktrees(f);
    } finally { f.cleanup(); }
  });
}

for (const [name, mutate] of [
  ['wrong bump', (root) => write(root, 'packages/core/package.json', '{"name":"@tautest/core","version":"3.0.0"}\n')],
  ['edited changelog history', (root) => write(root, 'packages/core/CHANGELOG.md', '# core\n\n## 2.0.6\n\nRewritten.\n')],
  ['missing changelog update', (root) => write(root, 'packages/core/CHANGELOG.md', '# core\n\n## 2.0.5\n\nOld entry.\n')],
  ['only one package versioned', (root) => write(root, 'packages/cli/package.json', '{"name":"tautest","version":"2.0.5"}\n')]
]) {
  test(`rejects ${name} even within allowed paths`, () => {
    const f = fixture();
    try {
      versionFixture(f.root); mutate(f.root); commit(f.root, name);
      assert.throws(() => validate(f), /does not exactly match/);
      assertCleanWorktrees(f);
    } finally { f.cleanup(); }
  });
}

test('rejects leaving any pending changeset behind, preventing a repeated version PR', () => {
  const f = fixture();
  try {
    versionFixture(f.root);
    write(f.root, '.changeset/second.md', git(f.root, 'show', `${f.base}:.changeset/second.md`) + '\n');
    commit(f.root, 'partial consumption');
    assert.throws(() => validate(f), /consume every pending changeset/);
  } finally { f.cleanup(); }
});

test('rejects deleting changesets without versioning packages', () => {
  const f = fixture();
  try {
    for (const name of ['first', 'second']) rmSync(path.join(f.root, `.changeset/${name}.md`));
    commit(f.root, 'delete only');
    assert.throws(() => validate(f), /must version at least one/);
  } finally { f.cleanup(); }
});

test('rejects file mode changes and symlink replacements', () => {
  for (const symlink of [false, true]) {
    const f = fixture();
    try {
      versionFixture(f.root);
      const file = path.join(f.root, 'packages/core/CHANGELOG.md');
      if (symlink) { rmSync(file); symlinkSync('../cli/CHANGELOG.md', file); }
      else chmodSync(file, 0o755);
      commit(f.root, 'mode change');
      assert.throws(() => validate(f), /unexpected change/);
    } finally { f.cleanup(); }
  }
});

test('fails closed on replay errors and removes its temporary worktree', () => {
  const f = fixture();
  try {
    versionFixture(f.root); commit(f.root, 'version');
    assert.throws(() => validate(f, { version: () => { throw new Error('Changesets failed'); } }), /Changesets failed/);
    assertCleanWorktrees(f);
  } finally { f.cleanup(); }
});

test('compares added generated files too, not only tracked modifications', () => {
  const f = fixture();
  try {
    versionFixture(f.root); commit(f.root, 'version');
    assert.throws(() => validate(f, { version: (_root, worktree) => {
      versionFixture(worktree); write(worktree, 'unexpected-generated.txt', 'unexpected\n');
    } }), /does not exactly match/);
    assertCleanWorktrees(f);
  } finally { f.cleanup(); }
});

test('requires a clean tracked checkout and a valid ancestor comparison base', () => {
  const f = fixture();
  try {
    versionFixture(f.root); const head = commit(f.root, 'version');
    write(f.root, 'packages/core/CHANGELOG.md', 'dirty\n');
    assert.throws(() => validate(f), /clean tracked checkout/);
    git(f.root, 'restore', '.');
    git(f.root, 'checkout', '-b', 'unrelated-base', f.base);
    write(f.root, 'only-on-base', 'base\n'); const unrelated = commit(f.root, 'diverged');
    git(f.root, 'checkout', '--detach', head);
    assert.throws(() => validate(f, { baseRef: unrelated }));
    assert.throws(() => validate(f, { baseRef: '--not-a-ref' }));
  } finally { f.cleanup(); }
});

test('the production replay runs the installed CLI on the base, not any repository script', () => {
  const f = fixture();
  try {
    versionFixture(f.root); commit(f.root, 'version');
    // A local fake CLI tests process execution and module resolution without installing software.
    // The tree validation tests above deliberately inject deterministic version output instead.
    const cli = 'node_modules/@changesets/cli';
    write(f.root, `${cli}/package.json`, '{"name":"@changesets/cli","type":"module","exports":{"./bin.js":"./bin.js"}}\n');
    write(f.root, `${cli}/bin.js`, [
      "import assert from 'node:assert/strict';",
      "import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';",
      "import path from 'node:path';",
      'assert.equal(process.argv[2], "version");',
      'assert.equal(JSON.parse(readFileSync("packages/core/package.json")).version, "2.0.5");',
      `const packages = ${JSON.stringify(packages)};`,
      write.toString(), versionFixture.toString(), 'versionFixture(process.cwd());'
    ].join('\n'));
    assert.equal(checkChangesets({ root: f.root, baseRef: f.base, log: () => {}, status: () => assert.fail('must not run status') }), 'version');
    assertCleanWorktrees(f);
  } finally { f.cleanup(); }
});

test('readiness retains all checks and runs this gate against the PR comparison base', () => {
  const workflow = readFileSync(new URL('../.github/workflows/release-readiness.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(workflow, /CHANGESET_BASE: \$\{\{ github\.event\.pull_request\.base\.sha \|\| 'origin\/main' \}\}/);
  assert.match(workflow, /run: node scripts\/check-changesets\.mjs "\$CHANGESET_BASE"/);
  assert.match(workflow, /- "scripts\/\*\*"/);
  for (const command of ['pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm coverage', 'pnpm build', 'pnpm audit --prod']) {
    assert.ok(workflow.includes(`run: ${command}\n`), command);
  }
  assert.doesNotMatch(workflow, /continue-on-error|secrets\.|head_ref|github\.actor|skip[ -]?ci/i);
  assert.match(workflow, /permissions:\n  contents: read\n/);
  for (const job of workflow.split(/\n  (?:audit|package-manager-smoke):\n/).slice(1)) {
    const preflight = job.indexOf('run: node scripts/check-changesets.mjs --preflight "$CHANGESET_BASE"');
    const install = job.indexOf('run: pnpm install --frozen-lockfile');
    assert.ok(preflight >= 0 && preflight < install, 'preflight precedes dependency installation in every readiness job');
  }
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(manifest.scripts.test.includes('scripts/check-changesets.test.mjs'));
});
