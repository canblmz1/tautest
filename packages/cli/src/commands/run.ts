import path from 'node:path';
import {
  buildFixPrompt,
  buildJsonReport,
  buildMarkdownReport,
  buildTerminalSummary,
  changedFilesToStrykerMutate,
  detectAiAuthor,
  detectPackageManager,
  detectProject,
  detectTestRunner,
  generateStrykerConfig,
  getActionableMutants,
  getChangedFiles,
  getChangedSourceFiles,
  getMutationVerdict,
  readStrykerJsonReport,
  runStryker,
  selectTopMutants,
  type PackageManager,
  type PromptStyle,
  type TestRunner,
  type TautestJsonReport
} from '@tautest/core';
import { loadCliConfig } from '../lib/config';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { ensureDir, writeJsonFile, writeTextFile } from '../lib/fs';
import { buildPromptCommands } from '../lib/prompt-commands';

export interface RunOptions {
  base?: string;
  threshold?: string;
  ai?: boolean;
  maxFiles?: string;
  reportDir?: string;
  cache?: boolean;
  config?: string;
  json?: boolean;
  dryRun?: boolean;
  promptStyle?: PromptStyle;
}

export interface RunResult {
  exitCode: number;
  output: string;
  reportDir: string;
  reportPath?: string;
  jsonReportPath?: string;
  promptPath?: string;
  mutationJsonPath?: string;
}

export async function runMutationCommand(cwd: string, options: RunOptions): Promise<RunResult> {
  const project = detectProject(cwd);

  if (!project.packageJsonPath || !project.packageJson) {
    throw new CliError('No package.json found.', EXIT_CODES.detectionError, 'Run Tautest from a Node.js project.');
  }

  const config = await loadCliConfig(project.rootDir, options.config);
  const baseRef = options.base ?? config.baseRef;
  const reportDir = path.resolve(project.rootDir, options.reportDir ?? config.outputDir);
  const mutationJsonPath = path.join(reportDir, 'mutation.json');
  const reportPath = path.join(reportDir, 'report.md');
  const reportJsonPath = path.join(reportDir, 'report.json');
  const promptPath = path.join(reportDir, 'fix-prompt.md');
  const runner = resolveRunner(options, config.testRunner, project);
  const packageManager = detectPackageManager(project.rootDir, project.packageJson).packageManager;
  const changedFiles = getChangedFiles({
    cwd: project.rootDir,
    baseRef,
    relative: true,
    sourceFileExtensions: config.sourceFileExtensions
  });
  const sourceFiles = getChangedSourceFiles(changedFiles);

  if (sourceFiles.length === 0) {
    const message = 'No changed production source files found. Nothing to mutate.';
    return {
      exitCode: EXIT_CODES.noOp,
      output: options.json ? `${JSON.stringify({ status: 'no-op', message, baseRef }, null, 2)}\n` : message,
      reportDir
    };
  }

  const maxFiles = parseOptionalInteger(options.maxFiles, '--max-files');

  if (maxFiles !== undefined && sourceFiles.length > maxFiles) {
    throw new CliError(
      `Changed source file count (${sourceFiles.length}) exceeds --max-files ${maxFiles}.`,
      EXIT_CODES.detectionError,
      'Increase --max-files or split the change into a smaller diff.'
    );
  }

  const mutatePatterns = changedFilesToStrykerMutate(sourceFiles, config.rangeCoalesceGap);

  if (options.dryRun) {
    const output = buildDryRunOutput({ baseRef, runner, reportDir, mutatePatterns, json: Boolean(options.json) });
    return {
      exitCode: EXIT_CODES.ok,
      output,
      reportDir
    };
  }

  ensureDir(reportDir);

  const strykerConfig = generateStrykerConfig({
    mutate: mutatePatterns,
    jsonReportPath: relative(project.rootDir, mutationJsonPath),
    testRunner: runner,
    packageManager: packageManagerForStryker(packageManager),
    incremental: options.cache === false ? false : config.stryker.incremental,
    incrementalFile: config.stryker.incrementalFile,
    vitestConfigFile: runner === 'vitest' ? relativeMaybe(project.rootDir, project.vitestConfigFiles[0]) : undefined,
    jestConfigFile: runner === 'jest' ? relativeMaybe(project.rootDir, project.jestConfigFiles[0]) : undefined,
    userConfig: config.stryker.userConfig,
    concurrency: config.stryker.concurrency,
    timeoutMS: config.stryker.timeoutMS,
    dryRunTimeoutMinutes: config.stryker.dryRunTimeoutMinutes,
    tsconfigFile: relativeMaybe(project.rootDir, project.tsconfig.path ?? undefined)
  });

  const runResult = await runStryker({
    cwd: project.rootDir,
    config: strykerConfig,
    jsonReportPath: mutationJsonPath
  });

  const summary = readStrykerJsonReport(mutationJsonPath);
  const score = getMutationVerdict(summary, config.score);
  const topMutants = selectTopMutants(getActionableMutants(summary), config.score.topMutants);
  const threshold = parseThreshold(options.threshold, config.score.mixed);
  const runtimeMs = runResult.endedAt.getTime() - runResult.startedAt.getTime();
  const promptStyle = options.promptStyle ?? config.prompt.style;
  const promptCommands = buildPromptCommands(baseRef, runner);
  const mutatedFiles = [...new Set(sourceFiles.map((file) => file.path))].sort();
  const aiAuthor = detectAiAuthor(process.env);
  const jsonReport: TautestJsonReport = buildJsonReport({
    summary,
    score,
    topMutants,
    threshold,
    scope: {
      baseRef,
      runner,
      mutatePatterns,
      mutatedFiles
    },
    aiSignals: {
      promptStyle,
      author: aiAuthor,
      commands: promptCommands
    },
    stryker: summary.stryker
  });
  const markdownReport = buildMarkdownReport({
    summary,
    score,
    topMutants,
    threshold,
    runner,
    runtimeMs,
    mutatePatterns,
    mutatedFiles
  });
  const prompt = buildFixPrompt({
    mutants: topMutants,
    testRunner: runner,
    commands: promptCommands,
    maxMutants: config.prompt.maxMutants,
    style: promptStyle
  });

  writeTextFile(reportPath, markdownReport);
  writeJsonFile(reportJsonPath, jsonReport);
  writeTextFile(promptPath, prompt);

  const thresholdPassed = summary.score !== null && summary.score >= threshold;
  const exitCode = thresholdPassed ? EXIT_CODES.ok : EXIT_CODES.thresholdFailed;
  const terminal = options.json
    ? `${JSON.stringify(
        {
          status: thresholdPassed ? 'passed' : 'threshold-failed',
          threshold,
          report: jsonReport,
          paths: {
            report: reportPath,
            json: reportJsonPath,
            prompt: promptPath,
            mutationJson: mutationJsonPath
          }
        },
        null,
        2
      )}\n`
    : [
        buildTerminalSummary(summary, score, {
          threshold,
          runner,
          runtimeMs,
          mutatedFiles,
          topMutants,
          reportPath,
          jsonReportPath: reportJsonPath,
          fixPromptPath: promptPath
        })
      ].join('\n');

  return {
    exitCode,
    output: terminal,
    reportDir,
    reportPath,
    jsonReportPath: reportJsonPath,
    promptPath,
    mutationJsonPath
  };
}

function resolveRunner(options: RunOptions, configured: TestRunner | 'auto', project: ReturnType<typeof detectProject>): TestRunner {
  if (configured !== 'auto') {
    return configured;
  }

  const detected = detectTestRunner(project);

  if (!detected.runner) {
    throw new CliError(detected.reason, EXIT_CODES.detectionError, 'Run `tautest init --runner vitest` or add a Vitest/Jest dependency.');
  }

  return detected.runner;
}

function parseThreshold(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new CliError('Invalid --threshold value.', EXIT_CODES.configError, 'Use a number between 0 and 100.');
  }

  return parsed;
}

function parseOptionalInteger(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliError(`Invalid ${flag} value.`, EXIT_CODES.configError, `Use a positive integer for ${flag}.`);
  }

  return parsed;
}

function buildDryRunOutput(input: {
  baseRef: string;
  runner: TestRunner;
  reportDir: string;
  mutatePatterns: string[];
  json: boolean;
}): string {
  if (input.json) {
    return `${JSON.stringify({ status: 'dry-run', ...input }, null, 2)}\n`;
  }

  return ['Tautest dry run', '', `Base ref: ${input.baseRef}`, `Runner: ${input.runner}`, `Report dir: ${input.reportDir}`, 'Mutate scope:', ...input.mutatePatterns.map((pattern) => `- ${pattern}`)].join('\n');
}

function packageManagerForStryker(packageManager: PackageManager): Exclude<PackageManager, 'bun'> | undefined {
  return packageManager === 'bun' ? undefined : packageManager;
}

function relative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function relativeMaybe(rootDir: string, filePath?: string): string | undefined {
  return filePath ? relative(rootDir, filePath) : undefined;
}
