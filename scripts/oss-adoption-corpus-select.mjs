#!/usr/bin/env node
// Applies the corpus selection rule to a repository, so candidate PRs are chosen before any result
// is seen. Walks merged PRs newest first and prints those that change at least one production
// file (under src/, not a test) and at least one test file, skipping bot, dependency, release and
// docs-only PRs. Base/head SHAs come straight from the GitHub API.
//
//   node scripts/oss-adoption-corpus-select.mjs --repo=radashi-org/radashi [--take=2] [--min-production-files=1] [--scan=100]
//
// Requires an authenticated `gh` CLI.
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));

if (!args.repo) {
  console.error('missing --repo=<owner/name>');
  process.exit(1);
}

const take = Number(args.take ?? 2);
const minProductionFiles = Number(args['min-production-files'] ?? 1);
const scan = Number(args.scan ?? 100);

const isTest = (file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || /(^|\/)(__tests__|tests?)\//.test(file);
const isProduction = (file) => /^src\//.test(file) && /\.[cm]?[jt]sx?$/.test(file) && !isTest(file) && !/\.d\.[cm]?ts$/.test(file);
const skipTitle = /^(chore|build|ci|docs|release|bump|deps?)\b|\bbump\b|\brelease\b|version packages/i;

function gh(apiPath) {
  return JSON.parse(execFileSync('gh', ['api', apiPath], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }));
}

// Merging updates a PR, so every recently merged PR is among the most recently updated ones.
// Collect enough of those, then order strictly by merge time before applying the filter.
const merged = [];
for (let page = 1; merged.length < scan && page <= 10; page++) {
  const pulls = gh(`repos/${args.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`);
  if (pulls.length === 0) break;
  merged.push(...pulls.filter((pull) => pull.merged_at));
}
merged.sort((a, b) => b.merged_at.localeCompare(a.merged_at));

const picked = [];
const skipped = [];
for (const pull of merged.slice(0, scan)) {
  if (picked.length >= take) break;
  if (pull.user.type === 'Bot' || skipTitle.test(pull.title)) {
    skipped.push({ number: pull.number, reason: pull.user.type === 'Bot' ? 'bot' : 'title' });
    continue;
  }
  const files = gh(`repos/${args.repo}/pulls/${pull.number}/files?per_page=100`).map((file) => file.filename);
  const production = files.filter(isProduction);
  const tests = files.filter(isTest);
  if (production.length >= minProductionFiles && tests.length > 0) {
    picked.push({ number: pull.number, title: pull.title, mergedAt: pull.merged_at, base: pull.base.sha, head: pull.head.sha, production, tests });
  } else {
    skipped.push({ number: pull.number, reason: `production files ${production.length}, test files ${tests.length}` });
  }
}

console.log(JSON.stringify({ repo: args.repo, ranAt: new Date().toISOString(), rule: { take, minProductionFiles, scan }, picked, skipped }, null, 2));
