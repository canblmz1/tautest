import path from 'node:path';
import { buildFixPrompt, type PromptStyle, type ReportMutant, type SurvivingMutant, type TestRunner } from '@tautest/core';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { fileExists, readJsonFile } from '../lib/fs';
import { buildPromptCommands } from '../lib/prompt-commands';

export interface PromptOptions {
  from?: string;
  style?: PromptStyle;
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

export function runPromptCommand(cwd: string, options: PromptOptions): string {
  const from = path.resolve(cwd, options.from ?? '.tautest/report.json');

  if (!fileExists(from)) {
    throw new CliError(`Report JSON not found: ${from}`, EXIT_CODES.configError, 'Run `tautest run` first or pass `--from <report.json>`.');
  }

  const report = readJsonFile<StoredReport>(from);
  const mutants = report.surviving ?? report.topMutants ?? report.summary?.survivingMutants ?? [];
  const runner = report.scope?.runner ?? report.meta?.testRunner ?? 'vitest';
  const baseRef = report.scope?.baseRef ?? report.meta?.baseRef;
  const style = options.style ?? report.aiSignals?.promptStyle ?? 'agent';

  return buildFixPrompt({
    mutants,
    testRunner: runner,
    commands: report.aiSignals?.commands ?? buildPromptCommands(baseRef, runner),
    style
  });
}
