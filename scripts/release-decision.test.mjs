import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { decide, registryState } from './release-decision.mjs';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('./release-decision.mjs', import.meta.url));
const workflowFile = fileURLToPath(new URL('../.github/workflows/release.yml', import.meta.url));

const exists = { state: 'exists' };
const missing = { state: 'missing' };
const broken = { state: 'error', detail: 'HTTP 503' };
const aligned = { tautest: '2.0.5', '@tautest/core': '2.0.5' };
const inRegistry = (cli, core) => ({ tautest: cli, '@tautest/core': core });
const fast = { retryDelayMs: 0, timeoutMs: 2_000 };

// ---- the decision table ----

const decisions = [
  { name: 'nothing pending and both versions on npm: skip', changesets: [], registry: inRegistry(exists, exists), action: 'skip', reason: /nothing to release/ },
  { name: 'a changeset pending and both versions on npm: version-PR path', changesets: ['fix.md'], registry: inRegistry(exists, exists), action: 'changesets', reason: /1 pending changeset/ },
  { name: 'nothing pending and neither version on npm: publish path', changesets: [], registry: inRegistry(missing, missing), action: 'changesets', reason: /publish path/ },
  { name: 'changesets pending and neither version on npm: version-PR path', changesets: ['a.md', 'b.md'], registry: inRegistry(missing, missing), action: 'changesets', reason: /2 pending changeset/ },
  { name: 'only tautest on npm: error', changesets: [], registry: inRegistry(exists, missing), action: 'error', reason: /partial npm publish.*on npm: tautest; not on npm: @tautest\/core/ },
  { name: 'only @tautest/core on npm: error', changesets: [], registry: inRegistry(missing, exists), action: 'error', reason: /partial npm publish.*on npm: @tautest\/core; not on npm: tautest/ },
  { name: 'a partial publish is still an error when a changeset is pending', changesets: ['fix.md'], registry: inRegistry(exists, missing), action: 'error', reason: /partial npm publish/ },
  { name: 'a registry error for one package while the other is published: error', changesets: [], registry: inRegistry(exists, broken), action: 'error', reason: /could not tell whether.*@tautest\/core: HTTP 503/ },
  { name: 'a registry error for both packages: error', changesets: [], registry: inRegistry(broken, broken), action: 'error', reason: /could not tell whether/ },
  { name: 'a registry error while a changeset is pending: error', changesets: ['fix.md'], registry: inRegistry(broken, exists), action: 'error', reason: /could not tell whether/ }
];

for (const { name, changesets, registry, action, reason } of decisions) {
  test(`decide: ${name}`, () => {
    const result = decide({ versions: aligned, pendingChangesets: changesets, registry });
    assert.equal(result.action, action);
    assert.match(result.reason, reason);
  });
}

test('decide: versions that are not aligned are an error whatever the registry says', () => {
  const result = decide({ versions: { tautest: '2.0.6', '@tautest/core': '2.0.5' }, pendingChangesets: [], registry: inRegistry(exists, exists) });
  assert.equal(result.action, 'error');
  assert.match(result.reason, /version-aligned/);
});

// ---- the registry client, against a local registry that records every request ----

async function startRegistry(routes) {
  const requests = [];
  const served = new Map();
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    const route = routes[request.url];
    const count = served.get(request.url) ?? 0;
    served.set(request.url, count + 1);
    const step = route === undefined ? { status: 404, body: { error: 'not found' } } : Array.isArray(route) ? route[Math.min(count, route.length - 1)] : route;
    setTimeout(() => {
      response.writeHead(step.status, { 'content-type': 'application/json' });
      const send = () => response.end(step.body === undefined ? '' : typeof step.body === 'string' ? step.body : JSON.stringify(step.body));
      if (step.bodyDelayMs) {
        response.flushHeaders();
        setTimeout(send, step.bodyDelayMs);
      } else send();
    }, step.delayMs ?? 0);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); })
  };
}

const published = (name, version) => ({ status: 200, body: { name, version } });
const summary = (registry) => registry.requests.map(({ method, url }) => `${method} ${url}`);

test('registryState: published verification rejects metadata when its tarball is still 404', async () => {
  const routes = { '/tautest/2.1.5': published('tautest', '2.1.5') };
  const registry = await startRegistry(routes);
  routes['/tautest/2.1.5'].body.dist = { tarball: `${registry.url}/package.tgz`, integrity: 'sha512-unused' };
  try {
    const result = await registryState(registry.url, 'tautest', '2.1.5', { ...fast, attempts: 1, verifyTarball: true });
    assert.equal(result.state, 'error');
    assert.match(result.detail, /tarball.*404/i);
  } finally { await registry.close(); }
});

test('registryState: published verification checks downloaded bytes against metadata integrity', async () => {
  const routes = { '/tautest/2.1.5': published('tautest', '2.1.5'), '/package.tgz': { status: 200, body: 'damaged bytes' } };
  const registry = await startRegistry(routes);
  routes['/tautest/2.1.5'].body.dist = { tarball: `${registry.url}/package.tgz`,
    integrity: `sha512-${createHash('sha512').update('expected bytes').digest('base64')}` };
  try {
    const result = await registryState(registry.url, 'tautest', '2.1.5', { ...fast, attempts: 1, verifyTarball: true });
    assert.equal(result.state, 'error');
    assert.match(result.detail, /integrity/i);
  } finally { await registry.close(); }
});

test('registryState: published verification retries a missing tarball, then accepts matching bytes', async () => {
  const bytes = 'expected package bytes';
  const routes = { '/tautest/2.1.5': published('tautest', '2.1.5'),
    '/package.tgz': [{ status: 404 }, { status: 200, body: bytes }] };
  const registry = await startRegistry(routes);
  routes['/tautest/2.1.5'].body.dist = { tarball: `${registry.url}/package.tgz`,
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
  try {
    const result = await registryState(registry.url, 'tautest', '2.1.5', { ...fast, attempts: 2, verifyTarball: true });
    assert.deepEqual(result, { state: 'exists' });
    assert.equal(registry.requests.filter(request => request.url === '/package.tgz').length, 2);
  } finally { await registry.close(); }
});

test('registryState: published verification requires distribution metadata', async () => {
  const registry = await startRegistry({ '/tautest/2.1.5': published('tautest', '2.1.5') });
  try {
    const result = await registryState(registry.url, 'tautest', '2.1.5', { ...fast, attempts: 1, verifyTarball: true });
    assert.equal(result.state, 'error');
    assert.match(result.detail, /distribution/i);
  } finally { await registry.close(); }
});

test('registryState: published verification times out while reading a tarball body after 200 headers', async () => {
  const routes = { '/tautest/2.1.5': published('tautest', '2.1.5'),
    '/package.tgz': { status: 200, body: 'bytes', bodyDelayMs: 400 } };
  const registry = await startRegistry(routes);
  routes['/tautest/2.1.5'].body.dist = { tarball: `${registry.url}/package.tgz`, integrity: 'sha512-unused' };
  const started = Date.now();
  try {
    const result = await registryState(registry.url, 'tautest', '2.1.5', { ...fast, timeoutMs: 50, attempts: 1, verifyTarball: true });
    assert.equal(result.state, 'error');
    assert.match(result.detail, /abort|timeout/i);
    assert(Date.now() - started < 1000);
  } finally { await registry.close(); }
});

test('registryState: 200 naming the version is published, 404 is not, and only GETs are sent', async () => {
  const registry = await startRegistry({ '/tautest/2.0.5': published('tautest', '2.0.5'), '/@tautest%2Fcore/2.0.5': published('@tautest/core', '2.0.5') });
  try {
    assert.deepEqual(await registryState(registry.url, 'tautest', '2.0.5', fast), { state: 'exists' });
    assert.deepEqual(await registryState(registry.url, '@tautest/core', '2.0.5', fast), { state: 'exists' });
    assert.deepEqual(await registryState(registry.url, 'tautest', '9.9.9', fast), { state: 'missing' });
    // The 404 is final: it is not retried. The scoped name keeps its slash encoded.
    assert.deepEqual(summary(registry), ['GET /tautest/2.0.5', 'GET /@tautest%2Fcore/2.0.5', 'GET /tautest/9.9.9']);
  } finally {
    await registry.close();
  }
});

test('registryState: a 5xx is retried, and a later 200 wins', async () => {
  const registry = await startRegistry({ '/tautest/2.0.5': [{ status: 503 }, { status: 502 }, published('tautest', '2.0.5')] });
  try {
    assert.deepEqual(await registryState(registry.url, 'tautest', '2.0.5', { ...fast, attempts: 3 }), { state: 'exists' });
    assert.equal(registry.requests.length, 3);
  } finally {
    await registry.close();
  }
});

test('registryState: waits a growing delay between attempts and does not wait after the last one', async () => {
  const registry = await startRegistry({ '/tautest/2.0.5': { status: 503 } });
  const delays = [];
  try {
    const result = await registryState(registry.url, 'tautest', '2.0.5', { timeoutMs: 2_000, attempts: 3, retryDelayMs: 10, sleep: async (ms) => { delays.push(ms); } });
    assert.equal(result.state, 'error');
    assert.deepEqual(delays, [10, 20]);
  } finally {
    await registry.close();
  }
});

for (const status of [401, 403, 429, 500, 503]) {
  test(`registryState: HTTP ${status} is an error, never "not published"`, async () => {
    const registry = await startRegistry({ '/tautest/2.0.5': { status } });
    try {
      const result = await registryState(registry.url, 'tautest', '2.0.5', { ...fast, attempts: 3 });
      assert.equal(result.state, 'error');
      assert.match(result.detail, new RegExp(`HTTP ${status} after 3 attempt`));
      assert.equal(registry.requests.length, 3);
    } finally {
      await registry.close();
    }
  });
}

test('registryState: a 200 that does not name the package and version, or is not JSON, is an error', async () => {
  const registry = await startRegistry({
    '/tautest/2.0.5': published('someone-else', '2.0.5'),
    '/tautest/2.0.6': published('tautest', '9.9.9'),
    '/tautest/2.0.7': { status: 200, body: 'not json at all' }
  });
  try {
    for (const version of ['2.0.5', '2.0.6', '2.0.7']) {
      assert.equal((await registryState(registry.url, 'tautest', version, { ...fast, attempts: 1 })).state, 'error');
    }
  } finally {
    await registry.close();
  }
});

test('registryState: an unreachable registry is an error, not "not published"', async () => {
  const registry = await startRegistry({});
  const { url } = registry;
  await registry.close();
  const result = await registryState(url, 'tautest', '2.0.5', { ...fast, attempts: 2 });
  assert.equal(result.state, 'error');
  assert.match(result.detail, /after 2 attempt/);
});

test('registryState: a registry that answers too slowly is an error', async () => {
  const registry = await startRegistry({ '/tautest/2.0.5': { ...published('tautest', '2.0.5'), delayMs: 400 } });
  try {
    const result = await registryState(registry.url, 'tautest', '2.0.5', { retryDelayMs: 0, timeoutMs: 50, attempts: 1 });
    assert.equal(result.state, 'error');
    assert.match(result.detail, /timeout|aborted/i);
  } finally {
    await registry.close();
  }
});

// ---- the script as the workflow runs it: exit code, $GITHUB_OUTPUT and the requests it made ----

function workspace({ cli = '2.0.5', core = '2.0.5', changesets = [], changesetDir = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'release-decision-'));
  for (const [dir, name, version] of [['packages/cli', 'tautest', cli], ['packages/core', '@tautest/core', core]]) {
    mkdirSync(path.join(root, dir), { recursive: true });
    writeFileSync(path.join(root, dir, 'package.json'), JSON.stringify({ name, version }));
  }
  if (changesetDir) {
    mkdirSync(path.join(root, '.changeset'));
    writeFileSync(path.join(root, '.changeset', 'README.md'), '# Changesets\n');
    writeFileSync(path.join(root, '.changeset', 'config.json'), '{}\n');
    for (const file of changesets) {
      writeFileSync(path.join(root, '.changeset', file), '---\n"tautest": patch\n---\n\nA change.\n');
    }
  }
  return root;
}

async function runScript(root, registry, extraArgs = []) {
  const outputFile = path.join(root, 'github-output.txt');
  writeFileSync(outputFile, '');
  const args = [script, `--root=${root}`, `--registry=${registry.url}`, '--retry-delay-ms=0', '--timeout-ms=2000', '--attempts=2', ...extraArgs];
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, { env: { ...process.env, GITHUB_OUTPUT: outputFile } });
    return { code: 0, stdout, stderr, output: readFileSync(outputFile, 'utf8') };
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr, output: readFileSync(outputFile, 'utf8') };
  }
}

const bothPublished = { '/tautest/2.0.5': published('tautest', '2.0.5'), '/@tautest%2Fcore/2.0.5': published('@tautest/core', '2.0.5') };

test('published verification CLI fails when both versions are missing instead of requesting publication', async () => {
  const root = workspace();
  const registry = await startRegistry({});
  try {
    const result = await runScript(root, registry, ['--verify-published=true']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /not downloadable/);
    assert.match(result.output, /action=error/);
    assert.doesNotMatch(result.output, /action=changesets/);
    assert.match(result.output, /pending_changesets=0/);
  } finally { await registry.close(); rmSync(root, { recursive: true, force: true }); }
});

test('published verification CLI rejects misaligned workspace versions', async () => {
  const root = workspace({ cli: '2.0.5', core: '2.0.6' });
  const registry = await startRegistry({});
  try {
    const result = await runScript(root, registry, ['--verify-published=true']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /version-aligned/);
  } finally { await registry.close(); rmSync(root, { recursive: true, force: true }); }
});

test('published verification CLI succeeds only after downloading both integrity-matched tarballs', async () => {
  const root = workspace();
  const routes = { '/tautest/2.0.5': published('tautest', '2.0.5'),
    '/@tautest%2Fcore/2.0.5': published('@tautest/core', '2.0.5'),
    '/package.tgz': { status: 200, body: 'verified package bytes' } };
  const registry = await startRegistry(routes);
  for (const route of ['/tautest/2.0.5', '/@tautest%2Fcore/2.0.5']) {
    routes[route].body.dist = { tarball: `${registry.url}/package.tgz`,
      integrity: `sha512-${createHash('sha512').update('verified package bytes').digest('base64')}` };
  }
  try {
    const result = await runScript(root, registry, ['--verify-published=true']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /tarball integrity were verified/);
    assert.equal(registry.requests.filter(request => request.url === '/package.tgz').length, 2);
  } finally { await registry.close(); rmSync(root, { recursive: true, force: true }); }
});
const scenarios = [
  { name: 'no changeset and both versions on npm: Changesets is skipped and the job succeeds', routes: bothPublished, code: 0, action: 'skip', stdout: /::notice.*skip: no pending changesets/ },
  { name: 'a changeset and both versions on npm: the version-PR path is kept', routes: bothPublished, workspace: { changesets: ['fix.md'] }, code: 0, action: 'changesets', stdout: /1 pending changeset/ },
  { name: 'no changeset and neither version on npm: the normal publish path is kept', routes: {}, code: 0, action: 'changesets', stdout: /publish path/ },
  { name: 'a changeset and neither version on npm: the version-PR path is kept', routes: {}, workspace: { changesets: ['fix.md'] }, code: 0, action: 'changesets', stdout: /1 pending changeset/ },
  { name: 'only tautest on npm: fails', routes: { '/tautest/2.0.5': published('tautest', '2.0.5') }, code: 1, action: 'error', stderr: /::error.*partial npm publish/ },
  { name: 'only @tautest/core on npm: fails', routes: { '/@tautest%2Fcore/2.0.5': published('@tautest/core', '2.0.5') }, code: 1, action: 'error', stderr: /::error.*partial npm publish/ },
  { name: 'the registry answers 503 for both: fails', routes: { '/tautest/2.0.5': { status: 503 }, '/@tautest%2Fcore/2.0.5': { status: 503 } }, code: 1, action: 'error', stderr: /could not tell whether/ },
  { name: 'the registry answers 503 for one package only: fails', routes: { '/tautest/2.0.5': published('tautest', '2.0.5'), '/@tautest%2Fcore/2.0.5': { status: 503 } }, code: 1, action: 'error', stderr: /could not tell whether/ },
  { name: 'the registry answers 403, which is not a 404: fails', routes: { '/tautest/2.0.5': { status: 403 }, '/@tautest%2Fcore/2.0.5': { status: 403 } }, code: 1, action: 'error', stderr: /HTTP 403/ },
  { name: 'versions that are not aligned: fails', routes: bothPublished, workspace: { cli: '2.0.6' }, code: 1, action: 'error', stderr: /version-aligned/ },
  { name: 'no .changeset directory: fails', routes: bothPublished, workspace: { changesetDir: false }, code: 1, action: 'error', stderr: /cannot inspect the workspace/ }
];

for (const { name, routes, workspace: options, code, action, stdout, stderr } of scenarios) {
  test(`release-decision.mjs: ${name}`, async () => {
    const root = workspace(options);
    const registry = await startRegistry(routes);
    try {
      const result = await runScript(root, registry);
      assert.equal(result.code, code, `${result.stdout}\n${result.stderr}`);
      assert.match(result.output, new RegExp(`^action=${action}$`, 'm'));
      if (stdout) assert.match(result.stdout, stdout);
      if (stderr) assert.match(result.stderr, stderr);
      // Nothing can publish: the script only ever reads, and only the two version documents.
      assert.ok(registry.requests.every(({ method }) => method === 'GET'), summary(registry).join('\n'));
      const allowed = [`/tautest/${options?.cli ?? '2.0.5'}`, `/@tautest%2Fcore/${options?.core ?? '2.0.5'}`];
      assert.ok(registry.requests.every(({ url }) => allowed.includes(url)), summary(registry).join('\n'));
    } finally {
      await registry.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
}

// ---- the workflow that uses it ----

function assertNpmTokenScope(workflow, allowedSteps) {
  const [header, ...steps] = workflow.split(/(?=^ {6}- name: )/m);
  const tokenName = /\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/;
  assert.doesNotMatch(header, tokenName, 'npm tokens are never workflow-wide or job-wide');
  const tokenSteps = [];
  for (const step of steps) {
    const name = step.match(/^ {6}- name: (.+)\n/)[1];
    const tokenLines = step.split('\n').filter((line) => tokenName.test(line));
    const expectedTokens = allowedSteps[name] ?? [];
    assert.deepEqual(tokenLines, expectedTokens.map((token) =>
      '          ' + token + ': ${{ secrets.NPM_TOKEN }}'
    ), name + ' receives only its allowed step-scoped npm tokens');
    if (expectedTokens.length > 0) {
      assert.match(step, /\n {8}env:\n/, name + ' has a step environment');
      tokenSteps.push(name);
    }
  }
  assert.deepEqual(tokenSteps, Object.keys(allowedSteps), 'all expected publish-capable steps are present');
}

test('release.yml runs Changesets only when the decision says so, keeps both Changesets paths, and grants nothing new', () => {
  const workflow = readFileSync(workflowFile, 'utf8').replace(/\r\n/g, '\n');
  // Changesets still shares one step environment between version-PR and publish paths.
  assertNpmTokenScope(workflow, {
    'Create release PR or publish packages': ['NPM_TOKEN', 'NODE_AUTH_TOKEN']
  });
  const decisionStep = workflow.indexOf('id: decide');
  const changesetsUse = workflow.indexOf('uses: changesets/action@v1');
  assert.ok(decisionStep > 0 && changesetsUse > decisionStep, 'the decision step comes before the Changesets step');
  assert.match(workflow, /- name: Decide release action\n\s+id: decide\n\s+run: node scripts\/release-decision\.mjs\n/);

  const changesetsStep = workflow.slice(workflow.lastIndexOf('- name:', changesetsUse), changesetsUse);
  assert.match(changesetsStep, /\n\s+if: steps\.decide\.outputs\.action == 'changesets'\n/);
  assert.match(workflow, /version: pnpm version-packages\n/);
  assert.match(workflow, /publish: pnpm release\n/);

  assert.match(workflow, /\npermissions:\n {2}contents: write\n {2}pull-requests: write\n {2}id-token: write\n\n/);
  assert.doesNotMatch(workflow, /skip[ -]?ci|ci[ -]?skip|no[ -]ci|skip[ -]actions|actions[ -]skip/i);
});

// ---- the tag workflow reuses the strict registry decision without a Changesets path ----

const tagWorkflowFile = fileURLToPath(new URL('../.github/workflows/publish-npm.yml', import.meta.url));

function tagAvailability() {
  const workflow = readFileSync(tagWorkflowFile, 'utf8').replace(/\r\n/g, '\n');
  const step = workflow.match(/      - name: Validate release availability\n[\s\S]*?(?=\n      - name:)/)?.[0];
  assert.ok(step, 'the tag workflow has an availability step');
  const inline = step.match(/node --input-type=module - "\$tag_version" <<'NODE'\n([\s\S]*?)\n {10}NODE\n/);
  assert.ok(inline, 'the availability step runs the inline Node preflight');
  return { workflow, step, source: inline[1].replace(/^ {10}/gm, '') };
}

async function runTagAvailability(root, registry) {
  const outputFile = path.join(root, 'tag-github-output.txt');
  writeFileSync(outputFile, '');
  // Run the workflow's exact Node body. Redirect its fetch calls to the mock registry;
  // reject any other origin so this test cannot contact the public registry.
  const redirectFetch = [
    'const originalFetch = globalThis.fetch;',
    'globalThis.fetch = (url, options) => {',
    '  const target = new URL(url);',
    "  if (target.origin !== 'https://registry.npmjs.org') throw new Error('unexpected registry origin');",
    '  return originalFetch(' + JSON.stringify(registry.url) + ' + target.pathname, options);',
    '};'
  ].join('\n');
  const args = ['--input-type=module', '--eval', redirectFetch + '\n' + tagAvailability().source, '-', '2.0.5'];
  const options = { cwd: path.dirname(path.dirname(script)), env: { ...process.env, GITHUB_OUTPUT: outputFile } };
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, options);
    return { code: 0, stdout, stderr, output: readFileSync(outputFile, 'utf8') };
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr, output: readFileSync(outputFile, 'utf8') };
  }
}

const tagScenarios = [
  { name: 'both exact versions exist: skip publishing', routes: bothPublished, code: 0, output: 'already_published=true\n' },
  { name: 'both versions are 404: allow publishing', routes: {}, code: 0, output: 'already_published=false\n' },
  { name: 'only tautest exists: stop', routes: { '/tautest/2.0.5': published('tautest', '2.0.5') }, code: 1, output: '', stderr: /partial npm publish/ },
  { name: 'only core exists: stop', routes: { '/@tautest%2Fcore/2.0.5': published('@tautest/core', '2.0.5') }, code: 1, output: '', stderr: /partial npm publish/ },
  { name: 'both lookups fail with 503: stop without a publish output', routes: { '/tautest/2.0.5': { status: 503 }, '/@tautest%2Fcore/2.0.5': { status: 503 } }, code: 1, output: '', stderr: /HTTP 503/ },
  { name: '403 and 404 are not two missing versions: stop', routes: { '/tautest/2.0.5': { status: 403 } }, code: 1, output: '', stderr: /HTTP 403/ },
  { name: 'a 200 with the wrong package identity: stop', routes: { ...bothPublished, '/tautest/2.0.5': published('someone-else', '2.0.5') }, code: 1, output: '', stderr: /HTTP 200 without tautest@2.0.5/ }
];

for (const { name, routes, code, output, stderr } of tagScenarios) {
  test('publish-npm.yml availability: ' + name, async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tag-availability-'));
    const registry = await startRegistry(routes);
    try {
      const result = await runTagAvailability(root, registry);
      assert.equal(result.code, code, result.stdout + '\n' + result.stderr);
      assert.equal(result.output, output);
      if (stderr) assert.match(result.stderr, stderr);
      assert.ok(registry.requests.every(({ method }) => method === 'GET'), summary(registry).join('\n'));
      assert.deepEqual([...new Set(registry.requests.map(({ url }) => url))].sort(), ['/@tautest%2Fcore/2.0.5', '/tautest/2.0.5']);
    } finally {
      await registry.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('publish-npm.yml uses the strict preflight before both guarded publish steps and grants nothing new', () => {
  const { workflow, step, source } = tagAvailability();
  assertNpmTokenScope(workflow, {
    'Publish @tautest/core': ['NODE_AUTH_TOKEN'],
    'Publish tautest': ['NODE_AUTH_TOKEN']
  });
  assert.match(source, /import \{ PACKAGES, decide, registryState \} from '\.\/scripts\/release-decision\.mjs';/);
  assert.match(source, /pendingChangesets: \[\]/);
  assert.doesNotMatch(step, /npm view|continue-on-error/);
  const availabilityIndex = workflow.indexOf(step);
  for (const name of ['@tautest/core', 'tautest']) {
    const publishStep = workflow.indexOf('- name: Publish ' + name + '\n');
    assert.ok(publishStep > availabilityIndex, 'availability precedes publishing ' + name);
    assert.match(workflow.slice(publishStep, workflow.indexOf('run: |', publishStep)), /if: steps\.availability\.outputs\.already_published != 'true'/);
  }
  assert.match(workflow, /\npermissions:\n {2}contents: read\n {2}id-token: write\n\n/);
  assert.doesNotMatch(workflow, /skip[ -]?ci|ci[ -]?skip|no[ -]ci|skip[ -]actions|actions[ -]skip/i);
});

// ---- unpublished packed packages must resolve locally in the Yarn smoke fixture ----

function yarnSmoke() {
  const workflow = readFileSync(new URL('../.github/workflows/release-readiness.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const step = workflow.match(/ {6}- name: Smoke install via [^\n]+\n[\s\S]*?(?=\n {6}- name:|$)/)?.[0];
  assert.ok(step, 'the readiness workflow keeps the package-manager smoke step');
  const inline = step.match(/node - "\$core_tgz" <<'NODE'\n([\s\S]*?)\n {10}NODE\n/);
  assert.ok(inline, 'the Yarn fixture resolves its packed core dependency before installation');
  return { step, source: inline[1].replace(/^ {10}/gm, '') };
}

test('release-readiness.yml keeps real Yarn tarball installation and CLI execution inside the temporary fixture', () => {
  const { step } = yarnSmoke();
  assert.match(step, /smoke_dir="\$\(mktemp -d\)"/);
  const enterFixture = step.indexOf('cd "$smoke_dir"');
  const yarnBranch = step.indexOf('elif [ "${{ matrix.package-manager }}" = "yarn" ]; then');
  const init = step.indexOf('yarn init -y', yarnBranch);
  const resolution = step.indexOf('node - "$core_tgz"', init);
  const install = step.indexOf('yarn add "@tautest/core@file:$core_tgz" "tautest@file:$cli_tgz"', resolution);
  const run = step.indexOf('yarn tautest --version', install);
  assert.ok(enterFixture >= 0 && yarnBranch > enterFixture && init > yarnBranch && resolution > init && install > resolution && run > install);
  assert.doesNotMatch(step, /continue-on-error|\|\|\s*true|\bpublish\b|\bexit\s+0\b/);
});

test('release-readiness.yml adds only a fixture-local core resolution and leaves production manifests and the tarball unchanged', async () => {
  const { source } = yarnSmoke();
  const root = mkdtempSync(path.join(tmpdir(), 'yarn-smoke-resolution-'));
  const fixture = path.join(root, 'smoke fixture');
  const coreTgz = path.join(root, 'release packs', 'tautest-core-9.9.9.tgz');
  const untouched = new Map(['package.json', 'packages/core/package.json', 'packages/cli/package.json'].map((file) =>
    [path.join(root, file), readFileSync(new URL('../' + file, import.meta.url), 'utf8')]
  ));
  untouched.set(coreTgz, 'packed core artifact');
  try {
    for (const [file, content] of untouched) {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    mkdirSync(fixture);
    const manifest = { name: 'tautest-yarn-smoke', version: '1.0.0', private: true };
    writeFileSync(path.join(fixture, 'package.json'), JSON.stringify(manifest));
    await execFileAsync(process.execPath, ['--eval', source, '-', coreTgz], { cwd: fixture });
    assert.deepEqual(JSON.parse(readFileSync(path.join(fixture, 'package.json'), 'utf8')), {
      ...manifest,
      resolutions: { '@tautest/core': `file:${coreTgz}` }
    });
    for (const [file, content] of untouched) {
      assert.equal(readFileSync(file, 'utf8'), content, `${file} stays unchanged`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
