import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('the real Yarn smoke installs unpublished tarballs from a hidden path without registry access', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'yarn packed smoke-'));
  const version = '0.0.0-unpublished-smoke';
  const packDir = path.join(root, '.tautest', 'release-packs');
  try {
    mkdirSync(packDir, { recursive: true });
    for (const name of ['@tautest/core', 'tautest']) {
      const isCore = name === '@tautest/core';
      const source = path.join(root, isCore ? 'core-source' : 'cli-source');
      const pkg = path.join(source, 'package');
      mkdirSync(pkg, { recursive: true });
      const manifest = isCore
        ? { name, version, main: 'index.js' }
        : { name, version, bin: { tautest: 'index.js' }, dependencies: { '@tautest/core': version } };
      writeFileSync(path.join(pkg, 'package.json'), JSON.stringify(manifest));
      writeFileSync(path.join(pkg, 'index.js'), isCore
        ? `exports.version = ${JSON.stringify(version)};\n`
        : '#!/usr/bin/env node\nconsole.log("fixture-core-version:" + require("@tautest/core").version);\n', { mode: 0o755 });
      const tarball = path.join(packDir, `${isCore ? 'tautest-core' : 'tautest'}-${version}.tgz`);
      await execFileAsync('tar', ['-czf', tarball, '-C', source, 'package']);
    }

    const workflow = readFileSync(new URL('../.github/workflows/release-readiness.yml', import.meta.url), 'utf8');
    const step = workflow.match(/ {6}- name: Smoke install via [^\n]+\n[\s\S]*?(?=\n {6}- name:|$)/)?.[0];
    const body = step?.match(/ {8}run: \|\n([\s\S]*)/)?.[1];
    assert.ok(body, 'execute the actual package-manager smoke shell from the workflow');
    const script = body.replace(/^ {10}/gm, '').replaceAll('${{ matrix.package-manager }}', 'yarn');
    // Execute the installed Yarn binary, with an empty task-local cache and no network.
    // The hidden .tautest path is essential: raw file arguments defeat Yarn 1's resolution glob there.
    const wrapper = 'yarn() { command yarn --offline --non-interactive --cache-folder "$YARN_SMOKE_CACHE" "$@"; }\n';
    const { stdout } = await execFileAsync('bash', ['-c', wrapper + script], {
      cwd: root,
      timeout: 30_000,
      env: { ...process.env, TMPDIR: root, YARN_SMOKE_CACHE: path.join(root, 'empty-cache') }
    });
    assert.ok(stdout.split('\n').includes(`fixture-core-version:${version}`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
