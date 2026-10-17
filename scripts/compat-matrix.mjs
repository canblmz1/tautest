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
write('pnpm-workspace.yaml', `packages:\n  - "."\noverrides:\n  "@tautest/core": ${JSON.stringify(override['@tautest/core'])}\n`);
run('pnpm', ['install']);

const coreDir = realpathSync(path.join(realpathSync(path.join(root, 'node_modules', 'tautest')), '..', '@tautest', 'core'));
if (!coreDir.includes('file+')) {
  fail(`tautest resolved @tautest/core from ${coreDir}, not from the local pack`);
}

write('tautest.config.json', JSON.stringify({ stryker: { concurrency: 1 } }));
const result = spawnSync('pnpm', ['exec', 'tautest', 'run', '--base', base, '--json'], { cwd: root, encoding: 'utf8', shell });
const label = `Stryker ${args.stryker} + Vitest ${args.vitest}`;

// Same rule as doctor's Vitest check: only runners up to 10.0.0 are known to run no tests on
// Vitest 5. A later runner is expected to pass the killed-mutant canary below instead, so a fixed
// release has to prove it executes tests before the guard is relaxed.
if (Number(args.vitest.split('.')[0]) >= 5 && compareVersions(args.stryker, '10.0.0') <= 0) {
  if (result.status !== 12 || !result.stderr.includes('executed 0 tests')) {
    fail(`${label}: expected exit 12 with "executed 0 tests", got exit ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  console.log(`ok  ${label}: refused to score (exit 12, surviving mutants executed 0 tests)`);
} else {
  if (result.status !== 0) {
    fail(`${label}: expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  const summary = JSON.parse(result.stdout).report.summary;
  const raw = JSON.parse(readFileSync(path.join(root, '.tautest', 'mutation.json'), 'utf8'));
  const framework = raw.framework;
  if (summary.killed !== 7 || summary.survived !== 4 || framework.version !== args.stryker) {
    fail(`${label}: expected 7 killed / 4 survived on Stryker ${args.stryker}, got ${summary.killed} / ${summary.survived} on ${framework.version}`);
  }
  // The canary: every killed mutant must have been killed by a test that actually ran.
  const killed = Object.values(raw.files).flatMap((file) => file.mutants).filter((mutant) => mutant.status === 'Killed');
  const notExecuted = killed.filter((mutant) => !(mutant.testsCompleted > 0) || !(mutant.killedBy?.length > 0));
  if (notExecuted.length > 0) {
    fail(`${label}: ${notExecuted.length} killed mutant(s) report no executed or killing test`);
  }
  console.log(`ok  ${label}: 7 killed / 4 survived, each kill by an executed test, run by StrykerJS ${framework.version}`);

  // Exercise the installed worker entry point, local config inheritance, and actual
  // test attribution. A unit stub cannot establish any of these properties.
  const target = raw.files['src/price.js'].mutants.find(m => m.status === 'Survived' && m.location.start.line === 2 && m.replacement === 'false');
  if (!target) fail(`${label}: missing negative-amount canary survivor`);
  write('baseline.json', JSON.stringify(raw));
  write('vitest.mutation.config.mjs', 'export default { test: { include: ["test/price.test.js"] } };\n');
  write('test/excluded.test.js', 'throw new Error("local Vitest config must exclude this file");\n');
  write('stryker.config.json', JSON.stringify({ testRunner: 'vitest', plugins: ['@stryker-mutator/vitest-runner'],
    vitest: { configFile: 'vitest.mutation.config.mjs', related: false }, coverageAnalysis: 'perTest', concurrency: 1, logLevel: 'error' }));
  const analysis = cliJson(['analyze', '--from', 'baseline.json', '--json'], 0);
  if (analysis.rawSummary.survived !== 4 || !analysis.groups.length) fail(`${label}: imported report lost survivors`);
  const weak = cliJson(['verify', '--from', 'baseline.json', '--mutant', target.id, '--test', 'test/price.test.js', '--budget', '90', '--json'], 1);
  if (weak.status !== 'not-verified') fail(`${label}: weak tests were reported verified`);
  write('test/price.test.js', priceTest([
    ['returns amount for non-members', 'expect(finalPrice(100, false)).toBe(100);'],
    ['members pay less', 'expect(finalPrice(100, true)).toBeLessThan(100);'],
    ['negative amounts return zero', 'expect(finalPrice(-1, false)).toBe(0);']
  ]));
  const verified = cliJson(['verify', '--from', 'baseline.json', '--mutant', target.id, '--test', 'test/price.test.js', '--budget', '90', '--json'], 0);
  if (verified.status !== 'verified' || !(verified.testsCompleted > 0) || !verified.killedBy.length) fail(`${label}: missing executed candidate kill`);
  if (readFileSync(path.join(root, 'src/price.js'), 'utf8') !== raw.files['src/price.js'].source) fail(`${label}: production source changed`);
  write('test/price.test.js', priceTest([['broken baseline', 'expect(finalPrice(100, false)).toBe(-999);']]));
  const broken = cliJson(['verify', '--from', 'baseline.json', '--mutant', target.id, '--test', 'test/price.test.js', '--budget', '90', '--json'], 12);
  if (broken.status !== 'error') fail(`${label}: a failing initial suite was accepted`);
  write('test/price.test.js', priceTest([['original passes', 'expect(finalPrice(100, false)).toBe(100);']]));
  write('stryker.config.json', JSON.stringify({ testRunner: 'vitest', buildCommand: 'node -e "setTimeout(()=>{},10000)"',
    plugins: ['@stryker-mutator/vitest-runner'], vitest: { configFile: 'vitest.mutation.config.mjs' }, logLevel: 'error' }));
  const limited = cliJson(['verify', '--from', 'baseline.json', '--mutant', target.id, '--test', 'test/price.test.js', '--budget', '1', '--json'], 12);
  if (limited.status !== 'incomplete' || !limited.execution.budgetExceeded) fail(`${label}: budget exhaustion was not incomplete`);
  console.log(`ok  ${label}: imported report, weak-test refusal, executed candidate kill, failed baseline, execution budget`);

  // Report-only users must not have to install a mutation engine.
  const lean = mkdtempSync(path.join(tmpdir(), 'tautest-analyze-only-'));
  writeFileSync(path.join(lean, 'package.json'), JSON.stringify({ private: true, type: 'module',
    dependencies: { tautest: `file:${cliTgz}`, '@tautest/core': `file:${coreTgz}` }, pnpm: { overrides: override } }));
  writeFileSync(path.join(lean, 'pnpm-workspace.yaml'), `packages:\n  - "."\noverrides:\n  "@tautest/core": ${JSON.stringify(override['@tautest/core'])}\n`);
  writeFileSync(path.join(lean, 'raw.json'), JSON.stringify(raw));
  const leanInstall = spawnSync('pnpm', ['install', '--ignore-scripts'], { cwd: lean, encoding: 'utf8', shell });
  if (leanInstall.status !== 0) fail(`${label}: report-only install failed\n${leanInstall.stdout}\n${leanInstall.stderr}`);
  const noEngine = spawnSync(process.execPath, ['--input-type=module', '-e', `import {createRequire} from 'node:module'; const coreRequire=createRequire(import.meta.resolve('@tautest/core')); try { coreRequire.resolve('@stryker-mutator/core'); process.exit(1); } catch (e) { if(e.code !== 'MODULE_NOT_FOUND') throw e; }`], { cwd: lean, encoding: 'utf8' });
  if (noEngine.status !== 0) fail(`${label}: could not establish engine-free report-only installation\n${noEngine.stderr}`);
  const leanAnalysis = spawnSync('pnpm', ['exec', 'tautest', 'analyze', '--from', 'raw.json', '--json'], { cwd: lean, encoding: 'utf8', shell });
  if (leanAnalysis.status !== 0 || JSON.parse(leanAnalysis.stdout).rawSummary.survived !== 4) fail(`${label}: report-only analysis failed\n${leanAnalysis.stdout}\n${leanAnalysis.stderr}`);
  console.log(`ok  ${label}: report analysis works with no Stryker installed, package config or git repository`);
}

// Explicitly disabling mutation must remain a no-op in an installed package too,
// including runner combinations that would be rejected if Stryker actually ran.
write('stryker.config.json', JSON.stringify({ mutate: [] }));
const disabled = spawnSync('pnpm', ['exec', 'tautest', 'run', '--base', base, '--json'], { cwd: root, encoding: 'utf8', shell });
if (disabled.status !== 2) {
  fail(`${label}: mutate: [] expected exit 2, got ${disabled.status}\n${disabled.stdout}\n${disabled.stderr}`);
}
const disabledFile = JSON.parse(disabled.stdout).changedFiles.find((file) => file.path === 'src/price.js');
if (disabledFile?.reason !== 'outside Stryker mutate scope') {
  fail(`${label}: mutate: [] did not exclude the changed source file`);
}
console.log(`ok  ${label}: explicit empty mutate scope skips Stryker (exit 2)`);

function priceTest(cases) {
  const body = cases.map(([name, assertion]) => `  it("${name}", () => { ${assertion} });`).join('\n');
  return `import { describe, it, expect } from "vitest";\nimport { finalPrice } from "../src/price.js";\n\ndescribe("finalPrice", () => {\n${body}\n});\n`;
}

function cliJson(commandArgs, expectedExit) {
  const output = spawnSync('pnpm', ['exec', 'tautest', ...commandArgs], { cwd: root, encoding: 'utf8', shell });
  if (output.status !== expectedExit) fail(`${commandArgs[0]}: expected ${expectedExit}, got ${output.status}\n${output.stdout}\n${output.stderr}`);
  return JSON.parse(output.stdout);
}

function compareVersions(left, right) {
  const a = left.split('-')[0].split('.').map(Number);
  const b = right.split('-')[0].split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) {
      return (a[index] ?? 0) - (b[index] ?? 0);
    }
  }
  return 0;
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
