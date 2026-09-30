#!/usr/bin/env node
// Decides what the Release workflow does once its checks have passed, so that a push to main which
// releases nothing no longer makes `changeset publish` try to publish versions npm already has.
//
//   node scripts/release-decision.mjs [--root=<repository root>] [--registry=<url>]
//
// It writes action=skip|changesets and a one-line reason to $GITHUB_OUTPUT (when set), and exits 1
// when the workflow has to stop instead of guessing:
//
//   a changeset is pending                 -> changesets  (version-PR path)
//   no changeset, both versions on npm     -> skip        (nothing to release; the Changesets step is not run)
//   no changeset, neither version on npm   -> changesets  (normal publish path)
//   only one version on npm, misaligned versions, an unreadable workspace, or a registry answer other
//   than 200 (published) or 404 (not published)               -> exit 1
//
// The registry is only ever read: one GET of /<package>/<version> per package. Nothing here can publish.
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PACKAGES = [
  { name: 'tautest', dir: 'packages/cli' },
  { name: '@tautest/core', dir: 'packages/core' }
];

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

// versions:          { <package name>: <version in the checkout> }
// pendingChangesets: names of the changeset files waiting on main
// registry:          { <package name>: { state: 'exists' | 'missing' | 'error', detail? } }
export function decide({ versions, pendingChangesets, registry }) {
  const names = PACKAGES.map((pkg) => pkg.name);
  const labels = names.map((name) => `${name}@${versions[name]}`);

  if (new Set(names.map((name) => versions[name])).size !== 1) {
    return { action: 'error', reason: `${labels.join(' and ')} must stay version-aligned.` };
  }

  const unknown = names.filter((name) => registry[name].state === 'error');
  if (unknown.length > 0) {
    const causes = unknown.map((name) => `${name}: ${registry[name].detail}`).join('; ');
    return { action: 'error', reason: `could not tell whether ${labels.join(' and ')} are on npm (${causes}); refusing to guess.` };
  }

  const published = names.filter((name) => registry[name].state === 'exists');
  if (published.length > 0 && published.length < names.length) {
    const notPublished = names.filter((name) => !published.includes(name));
    return {
      action: 'error',
      reason: `partial npm publish of ${versions[names[0]]}: on npm: ${published.join(', ')}; not on npm: ${notPublished.join(', ')}. Refusing to continue automatically.`
    };
  }

  if (pendingChangesets.length > 0) {
    return { action: 'changesets', reason: `${pendingChangesets.length} pending changeset(s): create or update the version PR.` };
  }
  if (published.length === names.length) {
    return { action: 'skip', reason: `no pending changesets and ${labels.join(' and ')} already exist on npm; nothing to release.` };
  }
  return { action: 'changesets', reason: `no pending changesets and ${labels.join(' and ')} are not on npm yet: publish path.` };
}

// Asks the registry about one exact version. Only a 200 that names the package and version counts as
// published and only a 404 counts as not published; anything else (other statuses, a wrong body, a
// network failure, a timeout) is an error, retried a few times because registries have bad minutes.
export async function registryState(registry, name, version, options = {}) {
  const { fetchImpl = fetch, timeoutMs = 15_000, attempts = 3, retryDelayMs = 1_000, sleep = defaultSleep } = options;
  const url = `${registry.replace(/\/+$/, '')}/${name.replace('/', '%2F')}/${encodeURIComponent(version)}`;

  let outcome = { state: 'error', detail: 'no request was made' };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    outcome = await queryOnce(url, name, version, fetchImpl, timeoutMs);
    if (outcome.state !== 'error') {
      return outcome;
    }
    if (attempt < attempts) {
      await sleep(retryDelayMs * attempt);
    }
  }
  return { state: 'error', detail: `${outcome.detail} after ${attempts} attempt(s)` };
}

async function queryOnce(url, name, version, fetchImpl, timeoutMs) {
  try {
    const response = await fetchImpl(url, { method: 'GET', headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (response.status === 404) {
      return { state: 'missing' };
    }
    if (response.status !== 200) {
      return { state: 'error', detail: `HTTP ${response.status}` };
    }
    const body = await response.json();
    return body?.name === name && body?.version === version
      ? { state: 'exists' }
      : { state: 'error', detail: `HTTP 200 without ${name}@${version} in the body` };
  } catch (error) {
    return { state: 'error', detail: error instanceof Error ? error.message : String(error) };
  }
}

export function readWorkspace(root) {
  const versions = {};
  for (const { name, dir } of PACKAGES) {
    const manifest = JSON.parse(readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
    if (manifest.name !== name || typeof manifest.version !== 'string' || manifest.version.length === 0) {
      throw new Error(`${dir}/package.json must be "${name}" with a version.`);
    }
    versions[name] = manifest.version;
  }

  // A changeset is any Markdown file in .changeset except its README, as in @changesets/read.
  const pendingChangesets = readdirSync(path.join(root, '.changeset'))
    .filter((file) => file.endsWith('.md') && file.toLowerCase() !== 'readme.md')
    .sort();
  return { versions, pendingChangesets };
}

export async function run({ root = process.cwd(), registry = DEFAULT_REGISTRY, outputFile, log = console.log, ...queryOptions } = {}) {
  let result;
  try {
    const { versions, pendingChangesets } = readWorkspace(root);
    const states = await Promise.all(PACKAGES.map(({ name }) => registryState(registry, name, versions[name], queryOptions)));
    const registryStates = Object.fromEntries(PACKAGES.map(({ name }, index) => [name, states[index]]));
    for (const { name } of PACKAGES) {
      log(`${name}@${versions[name]}: ${describe(registryStates[name])}`);
    }
    log(`pending changesets: ${pendingChangesets.length === 0 ? 'none' : pendingChangesets.join(', ')}`);
    result = decide({ versions, pendingChangesets, registry: registryStates });
  } catch (error) {
    result = { action: 'error', reason: `cannot inspect the workspace: ${error instanceof Error ? error.message : String(error)}` };
  }

  if (outputFile) {
    appendFileSync(outputFile, `action=${result.action}\nreason=${result.reason.replace(/\s+/g, ' ')}\n`);
  }
  return result;
}

function describe({ state, detail }) {
  return state === 'exists' ? 'already on npm' : state === 'missing' ? 'not on npm (404)' : `unknown (${detail})`;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function annotation(text) {
  return text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function numberOption(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`expected a non-negative number, got "${value}"`);
  }
  return number;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
  }));

  const result = await run({
    root: path.resolve(args.root ?? '.'),
    registry: args.registry ?? process.env.NPM_REGISTRY ?? DEFAULT_REGISTRY,
    outputFile: process.env.GITHUB_OUTPUT,
    timeoutMs: numberOption(args['timeout-ms'], 15_000),
    attempts: numberOption(args.attempts, 3),
    retryDelayMs: numberOption(args['retry-delay-ms'], 1_000)
  });

  if (result.action === 'error') {
    console.error(`::error title=Release decision::${annotation(result.reason)}`);
    process.exitCode = 1;
  } else {
    console.log(`::notice title=Release decision::${result.action}: ${annotation(result.reason)}`);
  }
}
