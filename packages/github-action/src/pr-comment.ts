import { readFileSync } from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';

export const COMMENT_MARKER = '<!-- tautest:report v=1 -->';

export interface CommentReport {
  score: number | null;
  verdict: string;
  killed: number;
  survived: number;
  noCoverage: number;
  reportPath?: string;
  fixPromptPath?: string;
  topMutants: Array<{
    filePath: string;
    line: number;
    mutatorName: string;
    original: string;
    replacement: string;
  }>;
}

export function buildPrComment(report: CommentReport): string {
  const score = report.score === null ? 'unknown' : `${report.score.toFixed(2)}%`;
  const topMutants = report.topMutants.slice(0, 10);
  const fixPrompt = report.fixPromptPath ? safeReadFile(report.fixPromptPath) : '';

  return [
    COMMENT_MARKER,
    '',
    '## Tautest Mutation Report',
    '',
    `**Verdict:** ${sanitize(report.verdict)}  `,
    `**Score:** ${sanitize(score)}  `,
    `**Killed:** ${report.killed} | **Survived:** ${report.survived} | **No coverage:** ${report.noCoverage}`,
    '',
    report.reportPath ? `Report: \`${sanitize(report.reportPath)}\`` : '',
    '',
    '### Top Surviving Mutants',
    '',
    topMutants.length > 0
      ? ['| File | Line | Mutator | Original | Replacement |', '| --- | ---: | --- | --- | --- |', ...topMutants.map(formatMutantRow)].join('\n')
      : 'No surviving mutants found.',
    '',
    '<details>',
    '<summary>Fix prompt</summary>',
    '',
    '```markdown',
    sanitize(fixPrompt || 'No fix prompt was generated.'),
    '```',
    '',
    '</details>'
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export async function upsertStickyComment(input: {
  token?: string;
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<'created' | 'updated' | 'skipped'> {
  if (!input.token) {
    core.warning('Skipping Tautest PR comment because no GitHub token is available.');
    return 'skipped';
  }

  const octokit = github.getOctokit(input.token);

  try {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueNumber,
      per_page: 100
    });
    const existing = findStickyComment(comments);

    if (existing) {
      await octokit.rest.issues.updateComment({
        owner: input.owner,
        repo: input.repo,
        comment_id: existing.id,
        body: input.body
      });
      return 'updated';
    }

    await octokit.rest.issues.createComment({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueNumber,
      body: input.body
    });
    return 'created';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.warning(`Could not write Tautest PR comment. This is often expected for fork PRs without pull-requests: write permission. ${message}`);
    return 'skipped';
  }
}

export function findStickyComment<T extends { body?: string | null }>(comments: T[]): T | undefined {
  return comments.find((comment) => comment.body?.includes(COMMENT_MARKER));
}

function formatMutantRow(mutant: CommentReport['topMutants'][number]): string {
  return `| \`${sanitize(mutant.filePath)}\` | ${mutant.line} | ${sanitize(mutant.mutatorName)} | ${codeCell(mutant.original)} | ${codeCell(mutant.replacement)} |`;
}

function codeCell(value: string): string {
  return sanitize(value).replace(/\s+/g, ' ').replace(/\|/g, '\\|');
}

function safeReadFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export function sanitize(value: string): string {
  return value.replace(/<!--/g, '&lt;!--').replace(/-->/g, '--&gt;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
