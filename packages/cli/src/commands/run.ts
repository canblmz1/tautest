import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import {
  buildFixPrompt,
  buildJsonReport,
  buildMarkdownReport,
  buildTerminalSummary,
  buildWorkspacePlan,
  buildWorkspaceMarkdownReport,
  buildWorkspaceRunReport,
  changedFilesToStrykerMutate,
  detectAiAuthor,
  detectPackageManager,
  detectProject,
  detectWorkspace,
  detectTestRunner,
  findTautestConfig,
  generateStrykerConfig,
  getStrykerConfigDiagnostics,
  getActionableMutants,
  getChangedFiles,
  getChangedSourceFiles,
  getMutationVerdict,
  readStrykerJsonReport,
  runStryker,
  selectTopMutants,
  parsePackageSelectors,
  type ChangedFile,
  type GenerateStrykerConfigOptions,
  type PackageManager,
  type PromptStyle,
  type RunMetrics,
  type TestRunner,
  type TautestJsonReport,
  type WorkspacePackageRunResult,
  type WorkspacePlan
} from '@tautest/core';
import { loadCliConfig } from '../lib/config';
import { CliError, mapUnknownError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';
import { ensureDir, readJsonFile, writeJsonFile, writeTextFile } from '../lib/fs';
import { buildPromptCommands } from '../lib/prompt-commands';

export interface RunOptions {
  base?: string;
  threshold?: string;
  ai?: boolean;
  maxFiles?: string;
  maxChangedLines?: string;
  reportDir?: string;
  cache?: boolean;
  config?: string;
  json?: boolean;
  dryRun?: boolean;
  promptStyle?: PromptStyle;
  workspace?: boolean | string;
  workspacePath?: string;
  packages?: string;
  affected?: boolean;
  all?: boolean;
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
  if (isWorkspaceMode(options)) {
    return runWorkspaceCommand(cwd, options);
  }

  return runSingleProjectMutationCommand(cwd, options);
}

async function runSingleProjectMutationCommand(cwd: string, options: RunOptions): Promise<RunResult> {
  const scopeStartedAt = Date.now();
  const project = detectProject(resolveWorkspaceCwd(cwd, resolveWorkspacePathOption(options)));

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
    const output = buildNoOpOutput({
      baseRef,
      runner,
      reportDir,
      changedFiles,
      json: Boolean(options.json)
    });
    return {
      exitCode: EXIT_CODES.noOp,
      output,
      reportDir
    };
  }

  const maxFiles = parseOptionalInteger(options.maxFiles, '--max-files');
  const maxChangedLines = parseOptionalInteger(options.maxChangedLines, '--max-changed-lines');

  if (maxFiles !== undefined && sourceFiles.length > maxFiles) {
    throw new CliError(
      `Changed source file count (${sourceFiles.length}) exceeds --max-files ${maxFiles}.`,
      EXIT_CODES.detectionError,
      'Increase --max-files or split the change into a smaller diff.'
    );
  }

  assertChangedSourceLineBudget(sourceFiles, maxChangedLines);

  const mutatePatterns = changedFilesToStrykerMutate(sourceFiles, config.rangeCoalesceGap);
  const runMetrics: RunMetrics = {
    changedFileCount: changedFiles.length,
    changedSourceFileCount: sourceFiles.length,
    changedSourceLineCount: countChangedSourceLines(sourceFiles),
    mutatedFileCount: new Set(sourceFiles.map((file) => file.path)).size,
    mutatePatternCount: mutatePatterns.length,
    partial: false,
    stageMs: {
      scopeMs: Date.now() - scopeStartedAt
    }
  };

  if (options.dryRun) {
    const output = buildDryRunOutput({
      baseRef,
      runner,
      reportDir,
      mutatePatterns,
      changedFiles,
      sourceFiles,
      json: Boolean(options.json)
    });
    return {
      exitCode: EXIT_CODES.ok,
      output,
      reportDir
    };
  }

  ensureDir(reportDir);

  const configStartedAt = Date.now();
  const strykerConfigOptions: GenerateStrykerConfigOptions = {
    mutate: mutatePatterns,
    jsonReportPath: relative(project.rootDir, mutationJsonPath),
    testRunner: runner,
    packageManager: packageManagerForStryker(packageManager),
    incremental: options.cache === false ? false : config.stryker.incremental,
    incrementalFile: config.stryker.incrementalFile,
    userConfig: config.stryker.userConfig,
    concurrency: config.stryker.concurrency,
    timeoutMS: config.stryker.timeoutMS,
    dryRunTimeoutMinutes: config.stryker.dryRunTimeoutMinutes,
    vitestConfigFile: runner === 'vitest' ? resolveRunnerConfigFile(project.rootDir, config.stryker.vitestConfigFile, project.vitestConfigFiles[0]) : undefined,
    jestConfigFile: runner === 'jest' ? resolveRunnerConfigFile(project.rootDir, config.stryker.jestConfigFile, project.jestConfigFiles[0]) : undefined,
    tsconfigFile: relativeMaybe(project.rootDir, project.tsconfig.path ?? undefined)
  };
  const strykerConfig = generateStrykerConfig(strykerConfigOptions);
  const strykerConfigDiagnostics = getStrykerConfigDiagnostics(strykerConfigOptions);
  const configMs = Date.now() - configStartedAt;

  const runResult = await runStryker({
    cwd: project.rootDir,
    config: strykerConfig,
    jsonReportPath: mutationJsonPath
  });

  const parseStartedAt = Date.now();
  const summary = readStrykerJsonReport(mutationJsonPath);
  const score = getMutationVerdict(summary, config.score);
  const topMutants = selectTopMutants(getActionableMutants(summary), config.score.topMutants);
  const threshold = parseThreshold(options.threshold, config.score.mixed);
  const runtimeMs = runResult.endedAt.getTime() - runResult.startedAt.getTime();
  const parseMs = Date.now() - parseStartedAt;
  let metrics: RunMetrics = {
    ...runMetrics,
    runtimeMs,
    stageMs: {
      ...runMetrics.stageMs,
      configMs,
      mutationMs: runtimeMs,
      parseMs
    }
  };
  const promptStyle = options.promptStyle ?? config.prompt.style;
  const promptCommands = buildPromptCommands(baseRef, runner);
  const mutatedFiles = [...new Set(sourceFiles.map((file) => file.path))].sort();
  const aiAuthor = detectAiAuthor(process.env);
  const reportStartedAt = Date.now();
  let jsonReport: TautestJsonReport = buildJsonReport({
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
    metrics,
    diagnostics: {
      strykerConfig: strykerConfigDiagnostics
    },
    aiSignals: {
      promptStyle,
      author: aiAuthor,
      commands: promptCommands
    },
    stryker: summary.stryker
  });
  let markdownReport = buildMarkdownReport({
    summary,
    score,
    topMutants,
    threshold,
    runner,
    runtimeMs,
    metrics,
    strykerConfigDiagnostics,
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
  metrics = {
    ...metrics,
    stageMs: {
      ...metrics.stageMs,
      reportMs: Date.now() - reportStartedAt
    }
  };
  jsonReport = buildJsonReport({
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
    metrics,
    diagnostics: {
      strykerConfig: strykerConfigDiagnostics
    },
    aiSignals: {
      promptStyle,
      author: aiAuthor,
      commands: promptCommands
    },
    stryker: summary.stryker
  });
  markdownReport = buildMarkdownReport({
    summary,
    score,
    topMutants,
    threshold,
    runner,
    runtimeMs,
    metrics,
    strykerConfigDiagnostics,
    mutatePatterns,
    mutatedFiles
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
          },
          metrics,
          diagnostics: {
            strykerConfig: strykerConfigDiagnostics
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
          metrics,
          strykerConfigDiagnostics,
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

async function runWorkspaceCommand(cwd: string, options: RunOptions): Promise<RunResult> {
  const workspace = detectWorkspace(cwd);

  if (!workspace.detected) {
    throw new CliError(
      'No workspace root was detected.',
      EXIT_CODES.detectionError,
      'Add pnpm-workspace.yaml or package.json workspaces, or use --workspace-path for a single package path.'
    );
  }

  const config = await loadCliConfig(workspace.rootDir, options.config);
  const baseRef = options.base ?? config.baseRef;
  const reportDir = path.resolve(workspace.rootDir, options.reportDir ?? config.outputDir);
  const packageSelectors = parsePackageSelectors(options.packages);
  const mode = options.all ? 'all' : packageSelectors.length > 0 ? 'packages' : 'affected';
  const changedFiles = getChangedFiles({
    cwd: workspace.rootDir,
    baseRef,
    relative: true,
    sourceFileExtensions: config.sourceFileExtensions
  });
  const plan = buildWorkspacePlan({
    cwd: workspace.rootDir,
    changedFiles,
    mode,
    packages: packageSelectors
  });

  if (options.dryRun) {
    return {
      exitCode: EXIT_CODES.ok,
      output: buildWorkspacePlanOutput({
        plan,
        baseRef,
        reportDir,
        json: Boolean(options.json)
      }),
      reportDir
    };
  }

  const workspaceReport = await runWorkspacePackages({
    plan,
    options,
    baseRef,
    reportDir
  });
  const reportPath = path.join(reportDir, 'workspace-report.md');
  const jsonReportPath = path.join(reportDir, 'workspace-report.json');

  writeJsonFile(jsonReportPath, workspaceReport);
  writeTextFile(reportPath, buildWorkspaceMarkdownReport(workspaceReport));

  return {
    exitCode: workspaceExitCode(workspaceReport.status),
    output: buildWorkspaceRunOutput({
      report: workspaceReport,
      reportPath,
      jsonReportPath,
      json: Boolean(options.json)
    }),
    reportDir,
    reportPath,
    jsonReportPath
  };
}

async function runWorkspacePackages(input: { plan: WorkspacePlan; options: RunOptions; baseRef: string; reportDir: string }) {
  const packageResults: WorkspacePackageRunResult[] = [];

  ensureDir(input.reportDir);

  for (const workspacePackage of input.plan.selectedPackages) {
    const packageReportDir = path.join(input.reportDir, 'packages', packageReportSlug(workspacePackage));

    try {
      const result = await runSingleProjectMutationCommand(workspacePackage.absolutePath, {
        ...input.options,
        base: input.baseRef,
        reportDir: packageReportDir,
        config: resolveWorkspacePackageConfig(input.plan.workspace.rootDir, workspacePackage.absolutePath, input.options.config),
        json: true,
        dryRun: false,
        workspace: undefined,
        workspacePath: undefined,
        packages: undefined,
        affected: undefined,
        all: undefined
      });

      packageResults.push(packageRunResult(workspacePackage, result));
    } catch (error) {
      const cliError = mapUnknownError(error);

      packageResults.push({
        name: workspacePackage.name,
        path: workspacePackage.path,
        status: 'error',
        exitCode: cliError.exitCode,
        reasons: workspacePackage.reasons,
        message: cliError.suggestion ? `${cliError.message} ${cliError.suggestion}` : cliError.message
      });
    }
  }

  const warnings = [...input.plan.warnings];

  if (input.plan.selectedPackages.length === 0) {
    warnings.push('Workspace plan selected no packages; no mutation runs were started.');
  }

  return buildWorkspaceRunReport({
    baseRef: input.baseRef,
    packageManager: input.plan.workspace.packageManager,
    workspaceRoot: input.plan.workspace.rootDir,
    reportDir: input.reportDir,
    packages: packageResults,
    warnings
  });
}

export function resolveWorkspaceCwd(cwd: string, workspace?: string): string {
  if (!workspace) {
    return cwd;
  }

  const root = path.resolve(cwd);
  const resolved = path.resolve(root, workspace);
  const relative = path.relative(root, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new CliError('--workspace must stay inside the current repository directory.', EXIT_CODES.configError, 'Pass a package/workspace path under the current directory.');
  }

  if (!existsSync(resolved)) {
    throw new CliError('Workspace path does not exist.', EXIT_CODES.configError, `Check the --workspace path: ${workspace}`);
  }

  if (!statSync(resolved).isDirectory()) {
    throw new CliError('Workspace path is not a directory.', EXIT_CODES.configError, `Check the --workspace path: ${workspace}`);
  }

  return resolved;
}

function resolveWorkspacePathOption(options: RunOptions): string | undefined {
  return typeof options.workspace === 'string' ? options.workspace : options.workspacePath;
}

function isWorkspaceMode(options: RunOptions): boolean {
  return options.workspace === true || Boolean(options.packages) || Boolean(options.affected) || Boolean(options.all);
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

export function buildDryRunOutput(input: {
  baseRef: string;
  runner: TestRunner;
  reportDir: string;
  mutatePatterns: string[];
  changedFiles: ChangedFile[];
  sourceFiles: ChangedFile[];
  json: boolean;
}): string {
  const included = input.sourceFiles.map((file) => ({
    path: file.path,
    ranges: file.ranges,
    lines: countChangedSourceLines([file])
  }));
  const excluded = input.changedFiles
    .filter((file) => !input.sourceFiles.some((sourceFile) => sourceFile.path === file.path))
    .map((file) => ({
      path: file.path,
      reason: exclusionReason(file)
    }));
  const totalLines = included.reduce((sum, file) => sum + file.lines, 0);
  const estimatedScope = estimateMutationScope(totalLines, included.length);

  if (input.json) {
    return `${JSON.stringify(
      {
        status: 'dry-run',
        ...input,
        included,
        excluded,
        totalChangedSourceLines: totalLines,
        estimatedScope
      },
      null,
      2
    )}\n`;
  }

  return [
    'Tautest dry run',
    '',
    `Base ref: ${input.baseRef}`,
    `Runner: ${input.runner}`,
    `Report dir: ${input.reportDir}`,
    `Estimated mutation scope: ${estimatedScope}`,
    `Changed production lines: ${totalLines}`,
    '',
    'Changed production files:',
    ...(included.length > 0 ? included.map((file) => `- ${file.path} lines ${formatRanges(file.ranges)} (${file.lines} changed ${file.lines === 1 ? 'line' : 'lines'})`) : ['- None']),
    '',
    'Excluded changed files:',
    ...(excluded.length > 0 ? excluded.map((file) => `- ${file.path}: ${file.reason}`) : ['- None']),
    '',
    'Stryker mutate scope:',
    ...input.mutatePatterns.map((pattern) => `- ${pattern}`)
  ].join('\n');
}

export function buildNoOpOutput(input: {
  baseRef: string;
  runner: TestRunner;
  reportDir: string;
  changedFiles: ChangedFile[];
  json: boolean;
}): string {
  const message = 'No changed production source files found. Nothing to mutate.';
  const excluded = input.changedFiles.map((file) => ({
    path: file.path,
    status: file.status,
    ranges: file.ranges,
    reason: exclusionReason(file),
    warnings: file.warnings
  }));
  const guidance = buildNoOpGuidance(excluded);

  if (input.json) {
    return `${JSON.stringify(
      {
        status: 'no-op',
        message,
        baseRef: input.baseRef,
        runner: input.runner,
        reportDir: input.reportDir,
        changedFiles: excluded,
        guidance
      },
      null,
      2
    )}\n`;
  }

  return [
    'Tautest no-op',
    '',
    message,
    '',
    `Base ref: ${input.baseRef}`,
    `Runner: ${input.runner}`,
    `Report dir: ${input.reportDir}`,
    `Changed files inspected: ${input.changedFiles.length}`,
    '',
    'Excluded changed files:',
    ...(excluded.length > 0 ? excluded.map((file) => `- ${file.path}: ${file.reason}`) : ['- None']),
    '',
    'Guidance:',
    ...guidance.map((item) => `- ${item}`)
  ].join('\n');
}

export function buildWorkspacePlanOutput(input: { plan: WorkspacePlan; baseRef: string; reportDir: string; json: boolean }): string {
  const selectedPackages = input.plan.selectedPackages.map((workspacePackage) => ({
    name: workspacePackage.name,
    path: workspacePackage.path,
    reasons: workspacePackage.reasons
  }));
  const unselectedPackages = input.plan.unselectedPackages.map((workspacePackage) => ({
    name: workspacePackage.name,
    path: workspacePackage.path
  }));
  const workspace = {
    rootDir: input.plan.workspace.rootDir,
    source: input.plan.workspace.source,
    packageManager: input.plan.workspace.packageManager,
    patterns: input.plan.workspace.patterns,
    packageCount: input.plan.workspace.packages.length,
    tools: input.plan.workspace.tools.map((tool) => ({
      tool: tool.tool,
      configPath: tool.configPath,
      message: tool.message
    })),
    confidence: input.plan.workspace.confidence
  };

  if (input.json) {
    return `${JSON.stringify(
      {
        status: 'workspace-plan',
        baseRef: input.baseRef,
        reportDir: input.reportDir,
        mode: input.plan.mode,
        workspace,
        selectedPackages,
        unselectedPackages,
        changedFiles: input.plan.changedFiles.map((file) => ({
          path: file.path,
          oldPath: file.oldPath,
          status: file.status,
          ranges: file.ranges,
          isSource: file.isSource,
          isTest: file.isTest,
          warnings: file.warnings
        })),
        warnings: input.plan.warnings
      },
      null,
      2
    )}\n`;
  }

  return [
    'Tautest workspace plan',
    '',
    `Base ref: ${input.baseRef}`,
    `Workspace root: ${workspace.rootDir}`,
    `Workspace source: ${workspace.source}`,
    `Package manager: ${workspace.packageManager ?? 'unknown'}`,
    `Mode: ${input.plan.mode}`,
    `Report dir: ${input.reportDir}`,
    '',
    'Selected packages:',
    ...(selectedPackages.length > 0
      ? selectedPackages.map((workspacePackage) => `- ${formatWorkspacePackage(workspacePackage)}: ${workspacePackage.reasons.join('; ')}`)
      : ['- None']),
    '',
    'Unselected packages:',
    ...(unselectedPackages.length > 0 ? unselectedPackages.map((workspacePackage) => `- ${formatWorkspacePackage(workspacePackage)}`) : ['- None']),
    '',
    'Warnings:',
    ...(input.plan.warnings.length > 0 ? input.plan.warnings.map((warning) => `- ${warning}`) : ['- None'])
  ].join('\n');
}

export function buildWorkspaceRunOutput(input: { report: ReturnType<typeof buildWorkspaceRunReport>; reportPath: string; jsonReportPath: string; json: boolean }): string {
  if (input.json) {
    return `${JSON.stringify(
      {
        status: input.report.status,
        report: input.report,
        paths: {
          report: input.reportPath,
          json: input.jsonReportPath
        }
      },
      null,
      2
    )}\n`;
  }

  return [
    `Tautest workspace: ${input.report.status}`,
    '',
    `Selected packages: ${input.report.summary.selected}`,
    `Passed: ${input.report.summary.passed}`,
    `Threshold failed: ${input.report.summary.thresholdFailed}`,
    `No-op: ${input.report.summary.noOp}`,
    `Errors: ${input.report.summary.errors}`,
    '',
    'Packages:',
    ...input.report.packages.map((item) => `- ${formatWorkspacePackage(item)}: ${item.status}${item.summary?.mutationScore === undefined ? '' : ` (${item.summary.mutationScore ?? 'unknown'}%)`}`),
    '',
    `Report: ${input.reportPath}`,
    `JSON: ${input.jsonReportPath}`
  ].join('\n');
}

export function countChangedSourceLines(files: ChangedFile[]): number {
  return files.reduce((sum, file) => {
    return sum + file.ranges.reduce((fileSum, range) => fileSum + range.end - range.start + 1, 0);
  }, 0);
}

function buildNoOpGuidance(excluded: Array<{ reason: string }>): string[] {
  if (excluded.length === 0) {
    return ['No changed files were found against the selected base ref. Check --base or fetch the target branch with full history.'];
  }

  const reasons = new Set(excluded.map((file) => file.reason));
  const guidance = ['This is expected for docs-only, config-only, deleted-only, binary-only, or test-only changes.'];

  if (reasons.has('test file')) {
    guidance.push('Changed tests are not mutated by Tautest; change production source or run your normal test suite for test-only PRs.');
  }

  if (reasons.has('deleted file')) {
    guidance.push('Deleted files have no current source lines to mutate; review deleted behavior with normal tests or add replacement coverage.');
  }

  if (reasons.has('non-source file')) {
    guidance.push('If a production file was excluded as non-source, add its extension to sourceFileExtensions in tautest.config.ts.');
  }

  if (reasons.has('no changed current source lines')) {
    guidance.push('If this was a rename or whitespace-only change, there may be no current changed lines for mutation.');
  }

  guidance.push('Run `tautest run --dry-run` to inspect included and excluded files before a mutation run.');
  return guidance;
}

export function assertChangedSourceLineBudget(files: ChangedFile[], maxChangedLines?: number): void {
  const changedSourceLines = countChangedSourceLines(files);

  if (maxChangedLines !== undefined && changedSourceLines > maxChangedLines) {
    throw new CliError(
      `Changed production line count (${changedSourceLines}) exceeds --max-changed-lines ${maxChangedLines}.`,
      EXIT_CODES.detectionError,
      'Run `tautest run --dry-run` to inspect scope, raise --max-changed-lines, or split the PR.'
    );
  }
}

function formatRanges(ranges: ChangedFile['ranges']): string {
  return ranges.map((range) => (range.start === range.end ? String(range.start) : `${range.start}-${range.end}`)).join(', ');
}

function exclusionReason(file: ChangedFile): string {
  if (file.status === 'deleted') {
    return 'deleted file';
  }

  if (file.isBinary) {
    return 'binary file';
  }

  if (file.isTest) {
    return 'test file';
  }

  if (!file.isSource) {
    return 'non-source file';
  }

  if (file.ranges.length === 0) {
    return 'no changed current source lines';
  }

  return 'not selected for mutation';
}

function estimateMutationScope(totalLines: number, fileCount: number): 'none' | 'small' | 'medium' | 'large' {
  if (totalLines === 0 || fileCount === 0) {
    return 'none';
  }

  if (totalLines <= 5 && fileCount <= 2) {
    return 'small';
  }

  if (totalLines <= 25 && fileCount <= 5) {
    return 'medium';
  }

  return 'large';
}

function formatWorkspacePackage(workspacePackage: { name: string | null; path: string }): string {
  return workspacePackage.name ? `${workspacePackage.name} (${workspacePackage.path})` : workspacePackage.path;
}

function packageRunResult(
  workspacePackage: { name: string | null; path: string; reasons: string[] },
  result: RunResult
): WorkspacePackageRunResult {
  const report = result.jsonReportPath && existsSync(result.jsonReportPath) ? readJsonFile<TautestJsonReport>(result.jsonReportPath) : undefined;

  return {
    name: workspacePackage.name,
    path: workspacePackage.path,
    status: packageStatus(result.exitCode),
    exitCode: result.exitCode,
    reasons: workspacePackage.reasons,
    message: result.exitCode === EXIT_CODES.noOp ? 'No changed production source files found.' : undefined,
    summary: report
      ? {
          verdict: report.summary.verdict,
          mutationScore: report.summary.mutationScore,
          threshold: report.summary.threshold,
          killed: report.summary.killed,
          survived: report.summary.survived,
          noCoverage: report.summary.noCoverage
        }
      : undefined,
    paths: {
      report: result.reportPath,
      json: result.jsonReportPath,
      prompt: result.promptPath,
      mutationJson: result.mutationJsonPath
    }
  };
}

function packageStatus(exitCode: number): WorkspacePackageRunResult['status'] {
  if (exitCode === EXIT_CODES.ok) {
    return 'passed';
  }

  if (exitCode === EXIT_CODES.thresholdFailed) {
    return 'threshold-failed';
  }

  if (exitCode === EXIT_CODES.noOp) {
    return 'no-op';
  }

  return 'error';
}

function workspaceExitCode(status: ReturnType<typeof buildWorkspaceRunReport>['status']): number {
  if (status === 'workspace-passed') {
    return EXIT_CODES.ok;
  }

  if (status === 'workspace-threshold-failed') {
    return EXIT_CODES.thresholdFailed;
  }

  if (status === 'workspace-no-op') {
    return EXIT_CODES.noOp;
  }

  return EXIT_CODES.detectionError;
}

function packageReportSlug(workspacePackage: { name: string | null; path: string }): string {
  return (workspacePackage.name ?? workspacePackage.path).replace(/^@/, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function resolveWorkspacePackageConfig(workspaceRoot: string, packageRoot: string, explicitConfig?: string): string | undefined {
  if (explicitConfig) {
    return path.resolve(workspaceRoot, explicitConfig);
  }

  if (findTautestConfig(packageRoot)) {
    return undefined;
  }

  return findTautestConfig(workspaceRoot) ?? undefined;
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

function resolveRunnerConfigFile(rootDir: string, configuredPath: string | undefined, detectedPath: string | undefined): string | undefined {
  if (!configuredPath) {
    return relativeMaybe(rootDir, detectedPath);
  }

  const resolved = path.resolve(rootDir, configuredPath);
  const relativePath = path.relative(rootDir, resolved);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new CliError(
      'Runner config path must stay inside the project directory.',
      EXIT_CODES.configError,
      'Use a path relative to the project root, such as config/jest.config.cjs.'
    );
  }

  return relativePath.replace(/\\/g, '/');
}
