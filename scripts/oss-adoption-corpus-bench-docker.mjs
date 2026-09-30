#!/usr/bin/env node
// Runs one frozen corpus row end to end in a disposable container, the way the Sprint 2 rows were run:
// the corpus harness validates the row (published Tautest installed in a fresh clone, Tautest against direct
// Stryker, a repeat), then the benchmark times the variants on that same clone.
//
//   node scripts/oss-adoption-corpus-bench-docker.mjs --row=unjs-defu-156 --tautest-version=2.0.5 \
//     [--rows=docs/evidence/benchmark/rows.json] [--out=docs/evidence/benchmark] [--image=node:22-bookworm] \
//     [--rounds=7] [--min-rounds=3] [--time-budget-minutes=45] [--budget-minutes=10] \
//     [--timeout-minutes=20] [--cooldown-seconds=5] [--max-timeouts=2]
//
// The evidence for the row lands in <out>/<row>/: validation/ (the harness result and raw reports), bench/
// (bench.json, the configs and the first report of every variant), container-environment.txt and
// host-docker.txt. The clone lives inside the container and disappears with it. Needs a running Docker.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));

if ('inside' in args) {
  inside();
} else {
  host();
}

function host() {
  for (const required of ['row', 'tautest-version']) {
    if (!args[required]) {
      fail(`missing --${required}`);
    }
  }
  const rows = JSON.parse(readFileSync(path.resolve(args.rows ?? 'docs/evidence/benchmark/rows.json'), 'utf8'));
  const row = rows.find((candidate) => candidate.name === args.row);
  if (!row) {
    fail(`no row "${args.row}" in the rows file; rows: ${rows.map((candidate) => candidate.name).join(', ')}`);
  }

  // The options that produced the row's Sprint 2 evidence, with the published version under test.
  const harness = [
    `--repo=${row.repo}`,
    `--pr=${row.pr}`,
    `--base=${row.base}`,
    `--head=${row.head}`,
    `--runner=${row.runner}`,
    `--package-manager=${row.packageManager}`,
    `--tautest-version=${args['tautest-version']}`,
    `--stryker-version=${row.strykerVersion}`,
    '--repeat=2',
    '--evidence-dir=/out/validation',
    ...(row.build ? ['--build'] : []),
    ...(row.setupEnv ? [`--env=${Object.entries(row.setupEnv).map(([key, value]) => `${key}=${value}`).join(',')}`] : []),
    ...(row.excludeFromMutation ? [`--exclude-from-mutation=${row.excludeFromMutation.join(',')}`] : []),
    ...(row.allowFreshTautest ? ['--allow-fresh-tautest'] : [])
  ];
  const bench = ['rounds', 'min-rounds', 'time-budget-minutes', 'budget-minutes', 'timeout-minutes', 'cooldown-seconds', 'max-timeouts']
    .filter((key) => args[key] !== undefined)
    .map((key) => `--${key}=${args[key]}`);

  const image = args.image ?? 'node:22-bookworm';
  const outDir = path.resolve(args.out ?? 'docs/evidence/benchmark', row.name);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'host-docker.txt'), hostDockerInfo(image));

  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const dockerArgs = [
    'run', '--rm', '--name', `tautest-bench-${row.name}`,
    '-v', `${scriptsDir}:/repo/scripts:ro`,
    '-v', `${outDir}:/out`,
    '-e', `BENCH_INPUT=${JSON.stringify({ harness, bench })}`,
    image, 'node', '/repo/scripts/oss-adoption-corpus-bench-docker.mjs', '--inside'
  ];
  console.error(`[bench-docker] ${row.name}: docker run ${image} (harness: ${harness.join(' ')}) (bench: ${bench.join(' ') || 'defaults'})`);
  const result = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
}

function hostDockerInfo(image) {
  const docker = (...argv) => {
    try {
      return execFileSync('docker', argv, { encoding: 'utf8' }).trim();
    } catch (error) {
      return `unavailable (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`;
    }
  };
  return [
    `date: ${new Date().toISOString()}`,
    `host: ${os.platform()} ${os.release()}, ${os.cpus().length} logical CPUs (${os.cpus()[0]?.model.trim()}), ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB`,
    `docker client/server: ${docker('version', '--format', '{{.Client.Version}} / {{.Server.Version}}')}`,
    `docker VM: ${docker('info', '--format', '{{.NCPU}} CPUs, {{.MemTotal}} bytes, kernel {{.KernelVersion}}, {{.OperatingSystem}}')}`,
    `image: ${image} ${docker('image', 'inspect', image, '--format', '{{.Id}}')}`,
    `containers running before the run: ${docker('ps', '--format', '{{.Names}} ({{.Image}})').replace(/\n/g, ', ') || 'none'}`,
    ''
  ].join('\n');
}

// In the container: enable corepack (so the project's own package manager is used), run the harness, and
// run the benchmark only if the harness status is ok.
function inside() {
  const input = JSON.parse(process.env.BENCH_INPUT ?? '{}');
  process.env.CI = 'true';
  process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = '0';
  mkdirSync('/out/validation', { recursive: true });

  const sh = (command) => execFileSync('bash', ['-c', command], { encoding: 'utf8' }).trim();
  spawnSync('corepack', ['enable'], { stdio: 'inherit' });
  writeFileSync('/out/container-environment.txt', [
    `date: ${new Date().toISOString()}`,
    `os: ${sh('. /etc/os-release; echo "$PRETTY_NAME"')} ${sh('uname -r')}`,
    `node: ${process.version} | npm ${sh('npm --version')} | corepack ${sh('corepack --version')}`,
    `cpus: ${os.cpus().length} (${os.cpus()[0]?.model.trim()}), memory ${(os.totalmem() / 2 ** 30).toFixed(1)} GiB`,
    `load average at start: ${os.loadavg().map((value) => value.toFixed(2)).join(' ')}`,
    ''
  ].join('\n'));

  const harness = spawnSync('node', ['/repo/scripts/oss-adoption-corpus-run.mjs', ...input.harness], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  writeFileSync('/out/validation/harness-stderr.txt', harness.stderr ?? '');
  let result;
  try {
    result = JSON.parse(readFileSync('/out/validation/result.json', 'utf8'));
  } catch (error) {
    console.error(`[bench-docker] the harness left no result.json: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
  console.error(`[bench-docker] harness status: ${result.status}; tautest exit ${result.tautest?.exitCode}; normal suite ${result.normalTests?.durationMs} ms`);
  if (result.status !== 'ok') {
    writeFileSync('/out/bench-skipped.txt', `The harness status is "${result.status}" (${result.error ?? 'no error message'}); the row is not benchmarked.\n`);
    process.exit(3);
  }

  const bench = spawnSync('node', ['/repo/scripts/oss-adoption-corpus-bench.mjs', '--result=/out/validation/result.json', '--out=/out/bench', ...(input.bench ?? [])], { stdio: 'inherit' });
  process.exit(bench.status ?? 1);
}

function fail(message) {
  console.error(`[bench-docker] ${message}`);
  process.exit(1);
}
