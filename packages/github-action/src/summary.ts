import * as core from '@actions/core';

export interface StepSummaryOutput {
  status: string;
  message?: string;
  cache?: StepSummaryCache;
  metrics?: {
    runtimeMs?: number;
    stageMs?: StageTimings;
    changedFileCount?: number;
    changedSourceFileCount?: number;
    changedSourceLineCount?: number;
    mutatedFileCount?: number;
    mutatePatternCount?: number;
    partial?: boolean;
    partialReason?: string;
  };
  diagnostics?: {
    strykerConfig?: Array<{
      severity: string;
      key: string;
      message: string;
      suggestion: string;
    }>;
  };
  report?: {
    summary?: {
      verdict?: string;
      mutationScore?: number | null;
      killed?: number;
      survived?: number;
      noCoverage?: number;
    };
    surviving?: Array<{
      filePath: string;
      line: number;
      mutatorName: string;
      original: string;
      replacement: string;
    }>;
  };
  paths?: {
    report?: string;
    json?: string;
    prompt?: string;
  };
}

interface StageTimings {
  scopeMs?: number;
  configMs?: number;
  mutationMs?: number;
  parseMs?: number;
  reportMs?: number;
}

export interface StepSummaryCache {
  enabled: boolean;
  cacheKey?: string;
  cachePath?: string;
  matchedKey?: string;
  saveStatus?: string;
  saveMessage?: string;
}

export function buildStepSummary(output: StepSummaryOutput): string {
  const summary = output.report?.summary;
  const verdict = summary?.verdict || (output.status === 'no-op' ? 'NO_CHANGES' : output.status || 'UNKNOWN');
  const score = formatScore(summary?.mutationScore);
  const killed = summary?.killed ?? 0;
  const survived = summary?.survived ?? 0;
  const noCoverage = summary?.noCoverage ?? 0;
  const topMutants = output.report?.surviving?.slice(0, 10) ?? [];

  return [
    '# Tautest',
    '',
    '| Verdict | Score | Killed | Survived | No coverage |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| ${cell(verdict)} | ${cell(score)} | ${killed} | ${survived} | ${noCoverage} |`,
    '',
    ...(output.message ? ['## Message', '', sanitize(output.message), ''] : []),
    ...buildMetricsSection(output.metrics),
    ...buildDiagnosticsSection(output.diagnostics),
    ...buildCacheSection(output.cache),
    '## Top Surviving Mutants',
    '',
    topMutants.length > 0
      ? [
          '| File | Line | Mutator | Original | Replacement |',
          '| --- | ---: | --- | --- | --- |',
          ...topMutants.map((mutant) => `| \`${cell(mutant.filePath)}\` | ${mutant.line} | ${cell(mutant.mutatorName)} | ${codeCell(mutant.original)} | ${codeCell(mutant.replacement)} |`)
        ].join('\n')
      : 'No surviving mutants found.',
    '',
    ...(output.paths?.report || output.paths?.json || output.paths?.prompt
      ? [
          '## Generated Files',
          '',
          ...(output.paths.report ? [`- Report: \`${cell(output.paths.report)}\``] : []),
          ...(output.paths.json ? [`- JSON: \`${cell(output.paths.json)}\``] : []),
          ...(output.paths.prompt ? [`- Fix prompt: \`${cell(output.paths.prompt)}\``] : []),
          ''
        ]
      : [])
  ].join('\n');
}

function buildMetricsSection(metrics: StepSummaryOutput['metrics']): string[] {
  if (!metrics) {
    return [];
  }

  return [
    '## Runtime and Scope',
    '',
    '| Runtime | Changed files | Production files | Production lines | Mutated files | Mutate patterns | Partial |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    `| ${cell(formatDuration(metrics.runtimeMs))} | ${metrics.changedFileCount ?? 0} | ${metrics.changedSourceFileCount ?? 0} | ${metrics.changedSourceLineCount ?? 0} | ${metrics.mutatedFileCount ?? 0} | ${metrics.mutatePatternCount ?? 0} | ${metrics.partial ? cell(metrics.partialReason || 'yes') : 'no'} |`,
    '',
    ...buildStageTimingSection(metrics.stageMs)
  ];
}

function buildStageTimingSection(stageMs: StageTimings | undefined): string[] {
  if (!stageMs) {
    return [];
  }

  return [
    '### Stage Timings',
    '',
    '| Scope | Config | Mutation | Parse | Report |',
    '| ---: | ---: | ---: | ---: | ---: |',
    `| ${formatDuration(stageMs.scopeMs)} | ${formatDuration(stageMs.configMs)} | ${formatDuration(stageMs.mutationMs)} | ${formatDuration(stageMs.parseMs)} | ${formatDuration(stageMs.reportMs)} |`,
    ''
  ];
}

function buildDiagnosticsSection(diagnostics: StepSummaryOutput['diagnostics']): string[] {
  const strykerConfig = diagnostics?.strykerConfig ?? [];

  if (strykerConfig.length === 0) {
    return [];
  }

  return [
    '## Stryker Config Diagnostics',
    '',
    '| Key | Message | Suggestion |',
    '| --- | --- | --- |',
    ...strykerConfig.slice(0, 10).map((diagnostic) => `| \`${cell(diagnostic.key)}\` | ${cell(diagnostic.message)} | ${cell(diagnostic.suggestion)} |`),
    ''
  ];
}

function buildCacheSection(cache: StepSummaryCache | undefined): string[] {
  if (!cache) {
    return [];
  }

  if (!cache.enabled) {
    return ['## Cache', '', 'Disabled for this run.', ''];
  }

  const restoreStatus = cache.matchedKey ? 'hit' : 'miss';

  return [
    '## Cache',
    '',
    '| Restore | Save | Key | Matched key | Cache file |',
    '| --- | --- | --- | --- | --- |',
    `| ${restoreStatus} | ${cell(cache.saveStatus || 'not-saved')} | ${codeCell(cache.cacheKey || 'unknown')} | ${codeCell(cache.matchedKey || 'none')} | ${codeCell(cache.cachePath || 'unknown')} |`,
    ...(cache.saveMessage ? ['', sanitize(cache.saveMessage)] : []),
    ''
  ];
}

export async function writeStepSummary(output: StepSummaryOutput): Promise<void> {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    core.info('Skipping Tautest job summary because GITHUB_STEP_SUMMARY is not available.');
    return;
  }

  try {
    await core.summary.addRaw(buildStepSummary(output), true).write();
    core.info('Wrote Tautest job summary.');
  } catch (error) {
    core.warning(`Could not write Tautest job summary: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? 'unknown' : `${score.toFixed(2)}%`;
}

function formatDuration(runtimeMs: number | undefined): string {
  if (runtimeMs === undefined) {
    return 'unknown';
  }

  return runtimeMs < 1000 ? `${runtimeMs}ms` : `${(runtimeMs / 1000).toFixed(1)}s`;
}

function codeCell(value: string): string {
  return cell(value).replace(/\s+/g, ' ');
}

function cell(value: string): string {
  return sanitize(value).replace(/\|/g, '\\|').replace(/`/g, "'");
}

function sanitize(value: string): string {
  return value.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
