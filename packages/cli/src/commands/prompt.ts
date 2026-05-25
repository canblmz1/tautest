import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildFixPrompt,
  buildLlmProvenance,
  buildLlmSuggestionMarkdown,
  DEFAULT_TAUTEST_CONFIG,
  redactPromptForLlm,
  type PromptStyle,
  type ReportMutant,
  type SurvivingMutant,
  type TestRunner
} from '@tautest/core';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { fileExists, readJsonFile, writeTextFile } from '../lib/fs';
import { loadCliConfig } from '../lib/config';
import { buildPromptCommands } from '../lib/prompt-commands';

export interface PromptOptions {
  from?: string;
  style?: PromptStyle;
  config?: string;
  suggest?: boolean;
  providerCommand?: string;
  providerArg?: string[];
  model?: string;
  suggestionOut?: string;
  redact?: boolean;
}

interface StoredReport {
  topMutants?: SurvivingMutant[];
  surviving?: ReportMutant[];
  summary?: {
    survivingMutants?: SurvivingMutant[];
  };
  scope?: {
    baseRef?: string;
    runner?: TestRunner;
  };
  aiSignals?: {
    promptStyle?: PromptStyle;
    commands?: string[];
  };
  meta?: {
    baseRef?: string;
    testRunner?: TestRunner;
  };
}

interface BuiltPrompt {
  prompt: string;
  runner: TestRunner;
  baseRef?: string;
}

export async function runPromptCommand(cwd: string, options: PromptOptions): Promise<string> {
  const built = buildPromptFromReport(cwd, options);

  if (!options.suggest) {
    return built.prompt;
  }

  const config = options.providerCommand && !options.config ? DEFAULT_TAUTEST_CONFIG : await loadCliConfig(cwd, options.config);
  const providerCommand = options.providerCommand ?? config.llm.command;

  if (!config.llm.enabled && !options.providerCommand) {
    throw new CliError(
      'LLM suggestion mode is disabled.',
      EXIT_CODES.configError,
      'Set llm.enabled: true with llm.command in tautest.config, or pass --provider-command for a one-off explicit run.'
    );
  }

  if (!providerCommand) {
    throw new CliError(
      'No LLM provider command configured.',
      EXIT_CODES.configError,
      'Pass --provider-command <executable> or configure llm.command. The command receives the prompt on stdin and writes Markdown to stdout.'
    );
  }

  const redactionEnabled = options.redact ?? config.llm.redact;
  const redacted = redactionEnabled ? redactPromptForLlm(built.prompt) : { text: built.prompt, redactions: [] };
  const args = options.providerCommand ? options.providerArg ?? [] : [...config.llm.commandArgs, ...(options.providerArg ?? [])];
  const suggestion = runProviderCommand(providerCommand, args, redacted.text);
  const redactionLabels = [...new Set(redacted.redactions.map((redaction) => redaction.label))];
  const redactionCount = redacted.redactions.reduce((total, redaction) => total + redaction.count, 0);
  const provenance = buildLlmProvenance({
    provider: 'external-command',
    model: options.model ?? config.llm.model,
    prompt: redacted.text,
    redaction: {
      enabled: redactionEnabled,
      count: redactionCount,
      labels: redactionLabels
    }
  });
  const outputPath = path.resolve(cwd, options.suggestionOut ?? path.join(config.outputDir, 'llm-suggestion.md'));
  const artifact = buildLlmSuggestionMarkdown({
    provenance,
    suggestion,
    promptPreview: redacted.text
  });

  writeTextFile(outputPath, artifact);

  return `LLM suggestion written: ${path.relative(cwd, outputPath) || outputPath}
Provider: external-command
Prompt SHA-256: ${provenance.promptSha256}
Redaction: ${redactionEnabled ? `enabled (${redactionCount} replacement${redactionCount === 1 ? '' : 's'})` : 'disabled'}
`;
}

function buildPromptFromReport(cwd: string, options: PromptOptions): BuiltPrompt {
  const from = path.resolve(cwd, options.from ?? '.tautest/report.json');

  if (!fileExists(from)) {
    throw new CliError(`Report JSON not found: ${from}`, EXIT_CODES.configError, 'Run `tautest run` first or pass `--from <report.json>`.');
  }

  const report = readJsonFile<StoredReport>(from);
  const mutants = report.surviving ?? report.topMutants ?? report.summary?.survivingMutants ?? [];
  const runner = report.scope?.runner ?? report.meta?.testRunner ?? 'vitest';
  const baseRef = report.scope?.baseRef ?? report.meta?.baseRef;
  const style = options.style ?? report.aiSignals?.promptStyle ?? 'agent';

  const prompt = buildFixPrompt({
    mutants,
    testRunner: runner,
    commands: report.aiSignals?.commands ?? buildPromptCommands(baseRef, runner),
    style
  });

  return { prompt, runner, baseRef };
}

function runProviderCommand(command: string, args: string[], prompt: string): string {
  const result = spawnSync(command, args, {
    input: prompt,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true
  });

  if (result.error) {
    throw new CliError('LLM provider command failed to start.', EXIT_CODES.configError, result.error.message, result.error);
  }

  if (result.status !== 0) {
    throw new CliError(
      `LLM provider command exited with code ${result.status ?? 'unknown'}.`,
      EXIT_CODES.configError,
      result.stderr?.trim() || 'Check the configured command and run it locally with a prompt on stdin.'
    );
  }

  return result.stdout ?? '';
}
