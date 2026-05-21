import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ActionInputs } from './inputs';

export interface TautestCommand {
  command: string;
  args: string[];
  strategy: 'local-workspace-cli' | 'pnpm-exec';
  localCliPath: string;
  localCliExists: boolean;
}

export interface ExecSnapshot {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface TautestDiagnosticInput {
  reason: string;
  command: TautestCommand;
  result: ExecSnapshot;
  versionCheck?: ExecSnapshot;
}

export function resolveTautestCommand(workspaceRoot: string): TautestCommand {
  const localCliPath = path.join(path.resolve(workspaceRoot), 'packages', 'cli', 'dist', 'index.js');
  const localCliExists = existsSync(localCliPath);

  if (localCliExists) {
    return {
      command: 'node',
      args: [localCliPath],
      strategy: 'local-workspace-cli',
      localCliPath,
      localCliExists
    };
  }

  return {
    command: 'pnpm',
    args: ['exec', 'tautest'],
    strategy: 'pnpm-exec',
    localCliPath,
    localCliExists
  };
}

export function buildTautestRunArgs(command: TautestCommand, inputs: ActionInputs, base: string): string[] {
  const args = [...command.args, 'run', '--base', base, '--threshold', String(inputs.threshold), '--json'];

  if (inputs.maxFiles) {
    args.push('--max-files', inputs.maxFiles);
  }

  if (inputs.maxChangedLines) {
    args.push('--max-changed-lines', inputs.maxChangedLines);
  }

  if (inputs.config) {
    args.push('--config', inputs.config);
  }

  if (inputs.promptStyle) {
    args.push('--prompt-style', inputs.promptStyle);
  }

  return args;
}

export function extractJson(stdout: string): string | null {
  const trimmed = stdout.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null;
}

export function formatTautestCliDiagnostics(input: TautestDiagnosticInput): string {
  return [
    input.reason,
    '',
    `Attempted command: ${formatCommand(input.command.command, input.command.args)}`,
    `Invocation strategy: ${input.command.strategy}`,
    `Exit code: ${input.result.exitCode}`,
    `Local CLI path: ${input.command.localCliPath}`,
    `Local CLI exists: ${input.command.localCliExists ? 'yes' : 'no'}`,
    '',
    'pnpm exec tautest --version:',
    input.versionCheck
      ? [
          `  exit code: ${input.versionCheck.exitCode}`,
          `  stdout: ${singleLineOrEmpty(input.versionCheck.stdout)}`,
          `  stderr: ${singleLineOrEmpty(input.versionCheck.stderr)}`
        ].join('\n')
      : '  not checked',
    '',
    'Command stdout (last 100 lines):',
    lastLines(input.result.stdout),
    '',
    'Command stderr (last 100 lines):',
    lastLines(input.result.stderr)
  ].join('\n');
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteArg).join(' ');
}

export function lastLines(value: string, maxLines = 100): string {
  const trimmed = value.trimEnd();

  if (!trimmed) {
    return '(empty)';
  }

  return trimmed.split(/\r?\n/).slice(-maxLines).join('\n');
}

function quoteArg(value: string): string {
  if (!/[\s"']/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function singleLineOrEmpty(value: string): string {
  return value.trim().replace(/\s+/g, ' ') || '(empty)';
}
