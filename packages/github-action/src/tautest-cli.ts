import { existsSync } from 'node:fs';
import path from 'node:path';
import type { ActionInputs, PackageManagerInput } from './inputs';

export interface TautestCommand {
  command: string;
  args: string[];
  strategy: 'local-workspace-cli' | 'local-node-modules-bin' | 'package-manager-exec';
  localCliPath: string;
  localCliExists: boolean;
  nodeModulesBinPath?: string;
  nodeModulesBinExists?: boolean;
  packageManager?: Exclude<PackageManagerInput, 'auto'>;
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
  versionCommand?: {
    command: string;
    args: string[];
  };
  versionCheck?: ExecSnapshot;
}

export interface ResolveTautestCommandOptions {
  workingDirectory?: string;
  packageManager?: Exclude<PackageManagerInput, 'auto'>;
}

export function resolveTautestCommand(workspaceRoot: string, options: ResolveTautestCommandOptions = {}): TautestCommand {
  const localCliPath = path.join(path.resolve(workspaceRoot), 'packages', 'cli', 'dist', 'index.js');
  const localCliExists = existsSync(localCliPath);
  const packageManager = options.packageManager ?? 'pnpm';
  const nodeModulesBinPath = options.workingDirectory ? path.join(path.resolve(options.workingDirectory), 'node_modules', '.bin', binName('tautest')) : undefined;
  const nodeModulesBinExists = nodeModulesBinPath ? existsSync(nodeModulesBinPath) : false;

  if (localCliExists) {
    return {
      command: 'node',
      args: [localCliPath],
      strategy: 'local-workspace-cli',
      localCliPath,
      localCliExists,
      nodeModulesBinPath,
      nodeModulesBinExists,
      packageManager
    };
  }

  if (nodeModulesBinPath && nodeModulesBinExists) {
    return {
      command: nodeModulesBinPath,
      args: [],
      strategy: 'local-node-modules-bin',
      localCliPath,
      localCliExists,
      nodeModulesBinPath,
      nodeModulesBinExists,
      packageManager
    };
  }

  const fallback = packageManagerExec(packageManager);

  return {
    command: fallback.command,
    args: fallback.args,
    strategy: 'package-manager-exec',
    localCliPath,
    localCliExists,
    nodeModulesBinPath,
    nodeModulesBinExists,
    packageManager
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
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // fall through to search
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return null;
    }
  }

  return null;
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
    `${input.versionCommand ? formatCommand(input.versionCommand.command, input.versionCommand.args) : formatCommand(input.command.command, [...input.command.args, '--version'])}:`,
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

function binName(command: string): string {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function packageManagerExec(packageManager: Exclude<PackageManagerInput, 'auto'>): { command: string; args: string[] } {
  if (packageManager === 'npm') {
    return { command: 'npm', args: ['exec', '--', 'tautest'] };
  }

  if (packageManager === 'yarn') {
    return { command: 'yarn', args: ['exec', 'tautest'] };
  }

  if (packageManager === 'bun') {
    return { command: 'bunx', args: ['tautest'] };
  }

  return { command: 'pnpm', args: ['exec', 'tautest'] };
}
