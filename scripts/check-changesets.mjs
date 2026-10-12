#!/usr/bin/env node
// Keep the contributor changeset gate, except for an exact replay of Changesets versioning.
// Run from the repository root: node scripts/check-changesets.mjs [--preflight] [base ref]
// No publish, install, repository script, branch name, or author identity is used here.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const releaseFiles = new Set([
  'packages/core/package.json', 'packages/core/CHANGELOG.md',
  'packages/cli/package.json', 'packages/cli/CHANGELOG.md'
]);
const isChangeset = (file) => /^\.changeset\/[^/]+\.md$/.test(file)
  && file.toLowerCase() !== '.changeset/readme.md';

function git(root, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
}

function changedFiles(root, base, head) {
  const fields = git(root, 'diff', '--raw', '--no-renames', '--no-abbrev', '-z', base, head, '--').split('\0');
  const changes = [];
  for (let i = 0; i < fields.length - 1; i += 2) {
    const [oldMode, newMode, , , status] = fields[i].slice(1).split(' ');
    changes.push({ file: fields[i + 1], oldMode, newMode, status });
  }
  return changes;
}

function pendingChangesets(root, ref) {
  return git(root, 'ls-tree', '-r', '--name-only', '-z', ref, '--', '.changeset')
    .split('\0').filter(isChangeset).sort();
}

function checkManifests(root, base, head) {
  const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  let versionChanged = false;
  for (const file of ['packages/core/package.json', 'packages/cli/package.json']) {
    const manifests = [base, head].map((ref) => {
      const manifest = JSON.parse(git(root, 'show', `${ref}:${file}`));
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
        || typeof manifest.version !== 'string' || !stableVersion.test(manifest.version)) {
        throw new Error(`${file} must be an object with a stable version string.`);
      }
      return manifest;
    });
    const [before, after] = manifests;
    versionChanged ||= before.version !== after.version;
    delete before.version;
    delete after.version;
    if (!isDeepStrictEqual(before, after)) {
      throw new Error(`Version-only manifests may change only version: ${file}.`);
    }
  }
  if (!versionChanged) throw new Error('Consuming changesets must version at least one release package.');
}

function runStatus(root, base) {
  execFileSync('pnpm', ['changeset', 'status', `--since=${base}`], { cwd: root, stdio: 'inherit' });
}

function replayVersion(root, worktree) {
  // The allowlist has already proved package.json, the lockfile, workspace definition and
  // Changesets config are identical to the base. Use the frozen-lockfile-installed CLI directly,
  // never the candidate's version-packages script. Versioning needs no install or network access.
  const cli = createRequire(path.join(root, 'package.json')).resolve('@changesets/cli/bin.js');
  symlinkSync(path.join(root, 'node_modules'), path.join(worktree, 'node_modules'), 'dir');
  execFileSync(process.execPath, [cli, 'version'], { cwd: worktree, stdio: 'inherit' });
}

export function checkChangesets({ root = process.cwd(), baseRef = 'origin/main',
  preflight = false, status = runStatus, version = replayVersion, log = console.log } = {}) {
  const base = git(root, 'rev-parse', '--verify', '--end-of-options', `${baseRef}^{commit}`).trim();
  const head = git(root, 'rev-parse', '--verify', 'HEAD^{commit}').trim();
  const changes = changedFiles(root, base, head);
  const consumed = changes.filter(({ file, status }) => status === 'D' && isChangeset(file));

  if (consumed.length === 0) {
    // Do not catch a failing contributor check and reinterpret it as a release candidate.
    if (!preflight) status(root, base);
    return 'contributor';
  }

  git(root, 'merge-base', '--is-ancestor', base, head);
  if (git(root, 'status', '--porcelain', '--untracked-files=no').trim()) {
    throw new Error('Version validation requires a clean tracked checkout.');
  }
  for (const { file, status, oldMode, newMode } of changes) {
    const deletion = isChangeset(file) && status === 'D' && oldMode === '100644' && newMode === '000000';
    const metadata = releaseFiles.has(file) && status === 'M' && oldMode === '100644' && newMode === '100644';
    if (!deletion && !metadata) {
      throw new Error(`Not a version-only candidate: unexpected change to ${file}.`);
    }
  }
  const pending = pendingChangesets(root, base);
  if (pendingChangesets(root, head).length !== 0 || pending.length !== consumed.length) {
    throw new Error('A version-only candidate must consume every pending changeset and add none.');
  }
  // Run before dependency installation as well as before replay: lifecycle scripts and
  // dependencies must not change the installed CLI we use to validate this candidate.
  checkManifests(root, base, head);
  if (preflight) {
    log('Version-only preflight passed; package manifests change only stable versions.');
    return 'version';
  }

  const scratch = mkdtempSync(path.join(tmpdir(), 'tautest-version-check-'));
  const worktree = path.join(scratch, 'base');
  let added = false;
  try {
    git(root, 'worktree', 'add', '--detach', worktree, base);
    added = true;
    version(root, worktree);
    // Reconstruct the tracked tree, including deletions and new generated files. The helper
    // node_modules symlink is never staged, even if the base does not ignore node_modules.
    git(worktree, 'add', '--all', '--', '.', ':!node_modules');
    const expected = git(worktree, 'write-tree').trim();
    const actual = git(root, 'rev-parse', `${head}^{tree}`).trim();
    if (expected !== actual) {
      throw new Error('Candidate does not exactly match Changesets versioning of the comparison base.');
    }
    log(`Validated exact version-only candidate; consumed ${pending.length} changeset(s).`);
    return 'version';
  } finally {
    try {
      if (added) git(root, 'worktree', 'remove', '--force', worktree);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const preflight = args[0] === '--preflight';
    if (preflight) args.shift();
    if (args.length > 1) throw new Error('Usage: node scripts/check-changesets.mjs [--preflight] [base ref]');
    checkChangesets({ baseRef: args[0], preflight });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
