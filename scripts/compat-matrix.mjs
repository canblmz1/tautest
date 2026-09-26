#!/usr/bin/env node
// Runs packed Tautest builds against one Stryker x Vitest combination and checks the verdict.
//
//   node scripts/compat-matrix.mjs --stryker=10.0.0 --vitest=4.1.11 --packs=<dir with the two .tgz files>
//
// The fixture is a two-line change whose tests kill 7 of its 11 mutants (checked by hand).
// On Vitest 5, @stryker-mutator/vitest-runner 9.x and 10.0.0 run no tests for mutants
// (stryker-mutator/stryker-js#6210), so Tautest must refuse to score instead.
//
// Installs use pnpm: npm 10.9 crashes resolving vitest + @stryker-mutator/core + vitest-runner
// ("Cannot read properties of null (reading 'edgesOut')") even without Tautest in the tree.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));

for (const required of ['stryker', 'vitest', 'packs']) {
  if (!args[required]) {
    fail(`missing --${required}`);
  }
}

const packs = path.resolve(args.packs);
const coreTgz = path.join(packs, findPack(/^tautest-core-.*\.tgz$/));
const cliTgz = path.join(packs, findPack(/^tautest-\d.*\.tgz$/));
const root = mkdtempSync(path.join(tmpdir(), `tautest-compat-s${args.stryker}-v${args.vitest}-`));
const shell = process.platform === 'win32';

write('.gitignore', 'node_modules/\n.tautest/\nreports/\n.stryker-tmp/\n');
write('package.json', JSON.stringify({ name: 'tautest-compat', private: true, type: 'module', scripts: { test: 'vitest run' } }, null, 2));
write('src/price.js', 'export function finalPrice(amount, isMember) {\n  if (isMember) return amount * 0.9;\n  return amount;\n}\n');
write('test/price.test.js', priceTest([['returns amount for non-members', 'expect(finalPrice(100, false)).toBe(100);']]));
git('init', '-q');
git('config', 'user.email', 'compat@example.invalid');
git('config', 'user.name', 'compat');
git('add', '-A');
git('commit', '-qm', 'base');
const base = git('rev-parse', 'HEAD');

write('src/price.js', 'export function finalPrice(amount, isMember) {\n  if (amount <= 0) return 0;\n  if (isMember && amount > 50) return amount * 0.9;\n  return amount;\n}\n');
write(
  'test/price.test.js',
  priceTest([
    ['returns amount for non-members', 'expect(finalPrice(100, false)).toBe(100);'],
    ['members pay less', 'expect(finalPrice(100, true)).toBeLessThan(100);']
  ])
);
git('add', '-A');
git('commit', '-qm', 'change');

// The override keeps tautest's own @tautest/core dependency on the local pack instead of the registry
// copy. pnpm 10 reads it from package.json, pnpm 11 from pnpm-workspace.yaml.
const override = { '@tautest/core': `file:${coreTgz}` };
write(
  'package.json',
  JSON.stringify(
    {
      name: 'tautest-compat',
      private: true,
      type: 'module',
      scripts: { test: 'vitest run' },
      devDependencies: {
        '@stryker-mutator/core': args.stryker,
        '@stryker-mutator/vitest-runner': args.stryker,
        '@tautest/core': `file:${coreTgz}`,
        tautest: `file:${cliTgz}`,
        vitest: args.vitest
      },
      pnpm: { overrides: override }
    },
    null,
    2
  )
);
write('pnpm-workspace.yaml', `overrides:\n  "@tautest/core": ${JSON.stringify(override['@tautest/core'])}\n`);
run('pnpm', ['install']);

const coreDir = realpathSync(path.join(realpathSync(path.join(root, 'node_modules', 'tautest')), '..', '@tautest', 'core'));
if (!coreDir.includes('file+')) {
  fail(`tautest resolved @tautest/core from ${coreDir}, not from the local pack`);
}

const result = spawnSync('pnpm', ['exec', 'tautest', 'run', '--base', base, '--json'], { cwd: root, encoding: 'utf8', shell });
const label = `Stryker ${args.stryker} + Vitest ${args.vitest}`;

if (Number(args.vitest.split('.')[0]) >= 5) {
  if (result.status !== 12 || !result.stderr.includes('executed 0 tests')) {
    fail(`${label}: expected exit 12 with "executed 0 tests", got exit ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  console.log(`ok  ${label}: refused to score (exit 12, surviving mutants executed 0 tests)`);
} else {
  if (result.status !== 0) {
    fail(`${label}: expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  const summary = JSON.parse(result.stdout).report.summary;
  const framework = JSON.parse(readFileSync(path.join(root, '.tautest', 'mutation.json'), 'utf8')).framework;
  if (summary.killed !== 7 || summary.survived !== 4 || framework.version !== args.stryker) {
    fail(`${label}: expected 7 killed / 4 survived on Stryker ${args.stryker}, got ${summary.killed} / ${summary.survived} on ${framework.version}`);
  }
  console.log(`ok  ${label}: 7 killed / 4 survived, run by StrykerJS ${framework.version}`);
}

function priceTest(cases) {
  const body = cases.map(([name, assertion]) => `  it("${name}", () => { ${assertion} });`).join('\n');
  return `import { describe, it, expect } from "vitest";\nimport { finalPrice } from "../src/price.js";\n\ndescribe("finalPrice", () => {\n${body}\n});\n`;
}

function findPack(pattern) {
  const match = readdirSync(packs).find((name) => pattern.test(name));
  if (!match) {
    fail(`no pack matching ${pattern} in ${packs}`);
  }
  return match;
}

function write(file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

function git(...gitArgs) {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();
}

function run(command, commandArgs) {
  const outcome = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', shell });
  if (outcome.status !== 0) {
    fail(`${command} ${commandArgs.join(' ')} failed\n${outcome.stdout}\n${outcome.stderr}`);
  }
}

function fail(message) {
  console.error(`compat-matrix: ${message}`);
  process.exit(1);
}
