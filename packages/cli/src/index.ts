#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PackageManager, PromptStyle, TestRunner } from '@tautest/core';
import { runDemoCommand } from './commands/demo';
import { runDoctorCommand } from './commands/doctor';
import { formatInitResult, runInit } from './commands/init';
import { runPromptCommand } from './commands/prompt';
import { runReportCommand } from './commands/report';
import { runMutationCommand } from './commands/run';
import { mapUnknownError, printCliError } from './lib/errors';
import { EXIT_CODES } from './lib/exit-codes';

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('tautest')
    .description('PR-focused mutation testing workflow layer powered by StrykerJS')
    .version(readCliVersion())
    .option('--debug', 'print debug details for errors');

  program
    .command('demo')
    .description('show the copy-paste demo for a passing test suite with a surviving mutant')
    .option('--json', 'print machine-readable JSON')
    .option('--run', 'run the repository demo fixture and restore it afterward')
    .action(async (options) => {
      await runAction(program, async () => {
        writeStdout(await runDemoCommand(process.cwd(), options));
        return EXIT_CODES.ok;
      });
    });

  program
    .command('init')
    .description('detect project settings and create tautest.config.ts')
    .option('-y, --yes', 'accept detected defaults')
    .option('--no-install', 'update config/package files without running package manager install')
    .option('--runner <runner>', 'test runner: vitest or jest', parseRunner)
    .option('--pm <pm>', 'package manager: npm, pnpm, yarn, or bun', parsePackageManager)
    .action(async (options) => {
      await runAction(program, async () => {
        const result = await runInit(process.cwd(), options);
        console.log(formatInitResult(result));
        return EXIT_CODES.ok;
      });
    });

  program
    .command('doctor')
    .description('check whether the current project is ready for Tautest')
    .option('--json', 'print machine-readable JSON')
    .action(async (options) => {
      await runAction(program, async () => {
        const result = await runDoctorCommand(process.cwd(), options);
        writeStdout(result.output);
        return result.hasErrors ? EXIT_CODES.detectionError : EXIT_CODES.ok;
      });
    });

  program
    .command('run')
    .description('run mutation testing for changed source lines')
    .option('--base <ref>', 'base ref for git diff')
    .option('--threshold <number>', 'minimum mutation score required to exit 0')
    .option('--ai', 'generate AI fix prompt output')
    .option('--max-files <number>', 'maximum changed source files to mutate')
    .option('--max-changed-lines <number>', 'maximum changed production lines to mutate')
    .option('--report-dir <dir>', 'directory for report outputs')
    .option('--no-cache', 'disable Stryker incremental mode for this run')
    .option('--config <path>', 'path to tautest config')
    .option('--workspace [path]', 'plan workspace packages; a path value keeps legacy package-directory behavior')
    .option('--workspace-path <path>', 'run from a workspace/package directory inside the current repository')
    .option('--packages <selectors>', 'comma-separated workspace package names or paths to select in workspace dry-run planning')
    .option('--affected', 'select packages affected by the current git diff in workspace dry-run planning')
    .option('--all', 'select every workspace package in workspace dry-run planning')
    .option('--json', 'print machine-readable JSON summary')
    .option('--dry-run', 'show mutate scope without running Stryker')
    .option('--prompt-style <style>', 'prompt style: agent, human, claude-code, cursor, codex, or opencode', parsePromptStyle)
    .action(async (options) => {
      await runAction(program, async () => {
        const result = await runMutationCommand(process.cwd(), options);
        writeStdout(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
        return result.exitCode;
      });
    });

  program
    .command('prompt')
    .description('print an AI fix prompt from a Tautest report JSON')
    .option('--from <path>', 'path to report.json')
    .option('--style <style>', 'prompt style: agent, human, claude-code, cursor, codex, or opencode', parsePromptStyle)
    .option('--config <path>', 'path to tautest config')
    .option('--suggest', 'ask an explicitly configured external command for a test-only patch suggestion')
    .option('--provider-command <command>', 'external provider command; receives the prompt on stdin and writes Markdown to stdout')
    .option('--provider-arg <arg>', 'argument passed to the external provider command; repeat for multiple args', collectValues, [])
    .option('--model <name>', 'provider model name recorded in the suggestion provenance')
    .option('--suggestion-out <path>', 'path to write the LLM suggestion artifact')
    .option('--no-redact', 'send the prompt to the provider command without built-in secret redaction')
    .action(async (options, command: Command) => {
      await runAction(program, async () => {
        const promptOptions = {
          ...options,
          redact: command.getOptionValueSource('redact') === 'default' ? undefined : options.redact
        };
        writeStdout(await runPromptCommand(process.cwd(), promptOptions));
        return EXIT_CODES.ok;
      });
    });

  program
    .command('report')
    .description('print a markdown report or write a static HTML report')
    .option('--from <path>', 'path to report.md, or report.json when --html is used')
    .option('--html', 'write a static HTML report from report.json')
    .option('--out <path>', 'output path for --html, defaulting to report.html next to report.json')
    .action(async (options) => {
      await runAction(program, async () => {
        writeStdout(runReportCommand(process.cwd(), options));
        return EXIT_CODES.ok;
      });
    });

  return program;
}

async function runAction(program: Command, action: () => Promise<number> | number): Promise<void> {
  try {
    process.exitCode = await action();
  } catch (error) {
    const cliError = mapUnknownError(error);
    printCliError(cliError, Boolean(program.opts<{ debug?: boolean }>().debug));
    process.exitCode = cliError.exitCode;
  }
}

function parseRunner(value: string): TestRunner {
  if (value === 'vitest' || value === 'jest') {
    return value;
  }

  throw new Error('--runner must be "vitest" or "jest".');
}

function parsePackageManager(value: string): PackageManager {
  if (value === 'npm' || value === 'pnpm' || value === 'yarn' || value === 'bun') {
    return value;
  }

  throw new Error('--pm must be "npm", "pnpm", "yarn", or "bun".');
}

function parsePromptStyle(value: string): PromptStyle {
  if (value === 'agent' || value === 'human' || value === 'claude-code' || value === 'cursor' || value === 'codex' || value === 'opencode') {
    return value;
  }

  throw new Error('--prompt-style/--style must be "agent", "human", "claude-code", "cursor", "codex", or "opencode".');
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function readCliVersion(): string {
  const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown };

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error('tautest package.json must include a version string.');
  }

  return packageJson.version;
}

if (isDirectExecution()) {
  await buildProgram().parseAsync(process.argv);
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}
