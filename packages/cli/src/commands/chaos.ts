import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildReliabilityMarkdownReport,
  buildReliabilityReport,
  buildReliabilityTerminalSummary,
  type ChaosProfile,
  type ReliabilityFinding
} from '@tautest/core';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { ensureDir, writeJsonFile, writeTextFile } from '../lib/fs';

export interface ChaosOptions {
  command?: string;
  profile?: string;
  seed?: string;
  json?: boolean;
  reportDir?: string;
}

export interface ChaosResult {
  exitCode: number;
  output: string;
  reportDir: string;
  jsonReportPath: string;
  markdownReportPath: string;
}

export async function runChaosCommand(cwd: string, options: ChaosOptions): Promise<ChaosResult> {
  if (!options.command) {
    throw new CliError('Missing --command for chaos run.', EXIT_CODES.configError, 'Pass the test command to run, for example --command "pnpm test".');
  }

  const reportDir = path.resolve(cwd, options.reportDir ?? '.tautest');
  const jsonReportPath = path.join(reportDir, 'chaos-report.json');
  const markdownReportPath = path.join(reportDir, 'chaos-report.md');
  const preloadPath = path.join(reportDir, 'chaos-runtime.mjs');
  const profile = resolveProfile(options.profile ?? 'latency-basic', options.seed);

  ensureDir(reportDir);
  writeTextFile(preloadPath, buildChaosPreload());

  const run = await runCommandWithChaos({
    cwd,
    command: options.command,
    preloadPath,
    profile
  });
  const findings = buildChaosFindings(run.exitCode, options.command);
  const report = buildReliabilityReport({
    kind: 'chaos',
    rootDir: cwd,
    files: [],
    findings,
    metadata: {
      command: options.command,
      profile,
      exitCode: run.exitCode,
      stdoutTail: tail(run.stdout),
      stderrTail: tail(run.stderr)
    }
  });

  writeJsonFile(jsonReportPath, report);
  writeTextFile(markdownReportPath, buildReliabilityMarkdownReport(report));

  const output = options.json
    ? `${JSON.stringify(
        {
          status: run.exitCode === 0 ? 'passed' : 'chaos-command-failed',
          report,
          paths: {
            json: jsonReportPath,
            markdown: markdownReportPath,
            preload: preloadPath
          }
        },
        null,
        2
      )}\n`
    : [
        buildReliabilityTerminalSummary(report).trimEnd(),
        '',
        `Command exit code: ${run.exitCode}`,
        `Profile: ${profile.name}`,
        `Seed: ${profile.seed}`,
        `JSON: ${jsonReportPath}`,
        `Markdown: ${markdownReportPath}`
      ].join('\n') + '\n';

  return {
    exitCode: run.exitCode === 0 ? EXIT_CODES.ok : EXIT_CODES.thresholdFailed,
    output,
    reportDir,
    jsonReportPath,
    markdownReportPath
  };
}

function resolveProfile(name: string, seedValue?: string): ChaosProfile {
  const seed = parseSeed(seedValue);
  const profiles: Record<string, Omit<ChaosProfile, 'seed'>> = {
    'latency-basic': {
      name: 'latency-basic',
      latencyMs: {
        min: 25,
        max: 125
      },
      errorRate: 0
    },
    'connection-errors': {
      name: 'connection-errors',
      latencyMs: {
        min: 0,
        max: 50
      },
      errorRate: 0.25
    },
    stress: {
      name: 'stress',
      latencyMs: {
        min: 100,
        max: 500
      },
      errorRate: 0.1
    }
  };
  const profile = profiles[name];

  if (!profile) {
    throw new CliError('Unknown chaos profile.', EXIT_CODES.configError, `Use one of: ${Object.keys(profiles).join(', ')}.`);
  }

  return {
    ...profile,
    seed
  };
}

function parseSeed(value: string | undefined): number {
  if (value === undefined) {
    return 1;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError('Invalid --seed value.', EXIT_CODES.configError, 'Use a non-negative integer seed.');
  }

  return parsed;
}

async function runCommandWithChaos(input: { cwd: string; command: string; preloadPath: string; profile: ChaosProfile }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      TAUTEST_CHAOS_PROFILE: JSON.stringify(input.profile),
      NODE_OPTIONS: [process.env['NODE_OPTIONS'], `--import=${pathToFileURL(input.preloadPath).href}`].filter(Boolean).join(' ')
    };
    const child = spawn(input.command, {
      cwd: input.cwd,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderr += text;
      process.stderr.write(text);
    });
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

function buildChaosFindings(exitCode: number, command: string): ReliabilityFinding[] {
  if (exitCode === 0) {
    return [];
  }

  return [
    {
      id: 'chaos-command-failed',
      category: 'chaos',
      severity: 'high',
      confidence: 'high',
      riskScore: 90,
      filePath: '.',
      title: 'Command failed under chaos profile',
      evidence: command,
      remediation: 'Inspect the chaos report tails and add deterministic timeout/error handling tests around the failing dependency path.',
      tags: ['chaos', 'fault-injection']
    }
  ];
}

function tail(value: string): string {
  return value.length <= 4000 ? value : value.slice(-4000);
}

function buildChaosPreload(): string {
  return `const profile = JSON.parse(process.env.TAUTEST_CHAOS_PROFILE ?? '{"seed":1,"latencyMs":{"min":0,"max":0},"errorRate":0}');
let state = Number(profile.seed) || 1;

function random() {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 0x100000000;
}

function latency() {
  const min = Number(profile.latencyMs?.min ?? 0);
  const max = Number(profile.latencyMs?.max ?? min);
  return Math.max(0, Math.round(min + random() * Math.max(0, max - min)));
}

async function wait(ms) {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (...args) => {
    const delay = latency();
    await wait(delay);

    if (random() < Number(profile.errorRate ?? 0)) {
      const error = new Error('Tautest chaos injected ConnectionError');
      error.code = 'TAUTEST_CHAOS_CONNECTION_ERROR';
      throw error;
    }

    return originalFetch(...args);
  };
}
`;
}
