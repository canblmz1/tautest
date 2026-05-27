import * as core from '@actions/core';
import type { TautestCache } from './cache';
import type { CommentReport } from './pr-comment';
import type { StepSummaryCache } from './summary';

export interface TautestActionOutput {
  status: 'passed' | 'threshold-failed' | 'no-op' | string;
  threshold?: number;
  message?: string;
  metrics?: {
    runtimeMs?: number;
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
      insight?: {
        missingBehavior?: string;
      };
    }>;
  };
  paths?: {
    report?: string;
    json?: string;
    prompt?: string;
    mutationJson?: string;
  };
}

export function buildCacheSummary(cacheState: TautestCache | null): StepSummaryCache {
  if (!cacheState) {
    return {
      enabled: true,
      saveStatus: 'not-restored',
      saveMessage: 'Cache restore was unavailable.'
    };
  }

  return {
    enabled: true,
    cacheKey: cacheState.cacheKey,
    cachePath: cacheState.cachePath,
    matchedKey: cacheState.matchedKey
  };
}

export function setActionOutputs(output: TautestActionOutput): void {
  const summary = output.report?.summary;
  const score = summary?.mutationScore;
  const verdict = summary?.verdict || (output.status === 'no-op' ? 'NO_CHANGES' : '');
  const surviving = summary?.survived ?? output.report?.surviving?.length ?? 0;
  const killed = summary?.killed ?? 0;
  const noCoverage = summary?.noCoverage ?? 0;

  core.setOutput('score', score === null || score === undefined ? '' : String(score));
  core.setOutput('verdict', verdict);
  core.setOutput('threshold', output.threshold === undefined ? '' : String(output.threshold));
  core.setOutput('killed', String(killed));
  core.setOutput('surviving', String(surviving));
  core.setOutput('no-coverage', String(noCoverage));
  core.setOutput('report-path', output.paths?.report || '');
  core.setOutput('json-path', output.paths?.json || '');
  core.setOutput('prompt-path', output.paths?.prompt || '');
  core.setOutput('mutation-json-path', output.paths?.mutationJson || '');
  core.setOutput('runtime-ms', output.metrics?.runtimeMs === undefined ? '' : String(output.metrics.runtimeMs));
  core.setOutput('changed-source-lines', output.metrics?.changedSourceLineCount === undefined ? '' : String(output.metrics.changedSourceLineCount));
}

export function buildCommentReport(output: TautestActionOutput): CommentReport {
  const summary = output.report?.summary;

  return {
    score: summary?.mutationScore ?? null,
    threshold: output.threshold,
    verdict: summary?.verdict || (output.status === 'no-op' ? 'NO_CHANGES' : 'UNKNOWN'),
    killed: summary?.killed ?? 0,
    survived: summary?.survived ?? 0,
    noCoverage: summary?.noCoverage ?? 0,
    reportPath: output.paths?.report,
    fixPromptPath: output.paths?.prompt,
    topMutants: output.report?.surviving ?? []
  };
}
