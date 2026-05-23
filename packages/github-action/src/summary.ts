import * as core from '@actions/core';

export interface StepSummaryOutput {
  status: string;
  message?: string;
  cache?: StepSummaryCache;
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

function codeCell(value: string): string {
  return cell(value).replace(/\s+/g, ' ');
}

function cell(value: string): string {
  return sanitize(value).replace(/\|/g, '\\|').replace(/`/g, "'");
}

function sanitize(value: string): string {
  return value.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
