import path from 'node:path';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import {
  buildFixPrompt, buildJsonReport, buildMarkdownReport, getActionableMutants, getMutationVerdict,
  groupReviewMutants, parseStrykerMutationReport, reviewHash,
  type PromptStyle, type ReviewDecision, type ReviewNote, type StrykerMutationReport, type TestRunner
} from '@tautest/core';
import { assertFreshSource, readReviewInput } from '../lib/review-input';
import { readJsonFile, writeJsonFile, writeTextFile } from '../lib/fs';
import { CliError } from '../lib/errors';
import { EXIT_CODES } from '../lib/exit-codes';

export interface AnalyzeOptions { from: string; reportDir?: string; runner?: TestRunner; json?: boolean; promptStyle?: PromptStyle }
export function runAnalyzeCommand(cwd: string, options: AnalyzeOptions): string {
  const input = readReviewInput(cwd, options.from);
  const out = path.resolve(cwd, options.reportDir ?? '.tautest/review');
  const outputs = ['report.json', 'report.md', 'review.json', 'fix-prompt.md', 'decisions.json'];
  const inputStat = statSync(input.path);
  if (outputs.some(name => {
    const file = path.join(out, name);
    if (file === input.path) return true;
    if (!existsSync(file)) return false;
    const outputStat = statSync(file);
    return realpathSync(file) === realpathSync(input.path) || (outputStat.dev === inputStat.dev && outputStat.ino === inputStat.ino);
  })) throw new CliError('The input report must not be an analysis output file.', EXIT_CODES.configError);
  const summary = parseStrykerMutationReport(input.report);
  const runnerName = options.runner ?? input.report.config?.testRunner;
  const runner = runnerName === 'vitest' || runnerName === 'jest' ? runnerName : undefined;
  const promptStyle = options.promptStyle ?? 'human';
  const actionable = getActionableMutants(summary);
  const contextHash = reviewContext(cwd, input.report, out, input.path);
  const notes = readNotes(path.join(out, 'decisions.json'));
  const groups = groupReviewMutants(actionable, contextHash, notes);
  const incomplete = summary.allMutants.some(m => !['Killed', 'Survived', 'NoCoverage', 'Timeout', 'RuntimeError', 'CompileError', 'Ignored'].includes(m.status));
  const score = incomplete ? { verdict: 'UNKNOWN' as const, score: summary.score, reason: 'Report contains unexecuted or unknown mutant states.' } : getMutationVerdict(summary);
  const commands = ['# Run your existing test command.', '# Use tautest verify with the original report, mutant id and candidate test file.', '# Run your existing Stryker command to refresh the full report.'];
  const validationLoop = ['Run the normal test suite against the original production code.',
    'Use tautest verify --from <original-report> --mutant <id> --test <candidate-file> to verify each target; add --file if ids repeat.',
    'Require a verified result: the initial suite passed and an executed test in the selected file killed the exact mutant.',
    'If the target survives, the run fails or the budget expires, do not claim a verified fix.',
    'Refresh the full report with the existing Stryker command and analyze it again.'];
  const normalized = buildJsonReport({ summary, score, topMutants: actionable,
    scope: { runner, mutatedFiles: Object.keys(input.report.files), mutatePatterns: input.report.config?.mutate }, aiSignals: { commands, validationLoop, promptStyle } });
  const review = { version: '1', input: { path: input.path, sha256: input.hash }, options: { runner, promptStyle }, contextHash, complete: !incomplete,
    rawSummary: normalized.summary, groups, note: 'Reviews are manual judgments. Raw Stryker statuses and score are unchanged. Groups share source expressions; they are not proven equivalent.' };
  writeJsonFile(path.join(out, 'report.json'), normalized);
  writeJsonFile(path.join(out, 'review.json'), review);
  const pending = groups.filter(g => !g.review || g.review.decision === 'needs-test');
  const markdown = buildMarkdownReport({ summary, score, topMutants: actionable, runner, mutatedFiles: Object.keys(input.report.files), title: 'Imported Stryker Report' });
  writeTextFile(path.join(out, 'report.md'), [
    markdown, '## Review queue', '',
    'Imported report only; no tests or configuration were executed. The raw mutation score is not a new quality-gate result.',
    incomplete ? 'Incomplete: unexecuted or unknown mutant states are present.' : 'All recorded mutant states are terminal.',
    contextHash ? 'Review decisions expire when project files change.' : 'Local source context is unavailable or stale; analysis is read-only and review decisions cannot be recorded. Use the matching project checkout to record decisions within the documented snapshot limits.', '',
    ...groups.map(g => `- ${g.id}: ${g.filePath}:${g.line} (${g.mutants.length} mutants), ${g.review ? `manual ${g.review.decision}: ${g.review.reason.replace(/\s+/g, ' ')}` : g.staleReview ? 'unreviewed (previous decision expired)' : 'unreviewed'}`), ''
  ].join('\n'));
  if (runner) {
    writeTextFile(path.join(out, 'fix-prompt.md'), buildFixPrompt({ mutants: pending.flatMap(g => g.mutants), testRunner: runner,
      maxMutants: actionable.length, style: promptStyle, commands, validationLoop }));
  } else {
    writeTextFile(path.join(out, 'fix-prompt.md'), 'Runner not recorded. Re-run analyze with --runner vitest or --runner jest to generate a test-fix prompt.\n');
  }
  return options.json ? JSON.stringify({ status: 'analyzed', ...review, paths: { report: path.join(out, 'report.md'), json: path.join(out, 'report.json'), review: path.join(out, 'review.json'), prompt: path.join(out, 'fix-prompt.md') } }, null, 2) + '\n'
    : `Imported Stryker report: ${summary.total} mutants, ${actionable.length} actionable, ${groups.length} expression groups, ${pending.length} awaiting tests/review.\nRaw score: ${summary.score === null ? 'unknown' : summary.score.toFixed(2) + '%'}${incomplete ? ' (incomplete report)' : ''}.\nReport: ${path.join(out, 'report.md')}\nReview: ${path.join(out, 'review.json')}\n`;
}

export function runReviewCommand(cwd: string, groupId: string, options: { reportDir?: string; decision: ReviewDecision; reason: string }): string {
  if (!['needs-test', 'equivalent', 'accepted-risk'].includes(options.decision) || !options.reason.trim()) throw new CliError('A review needs a decision and a non-empty reason.', EXIT_CODES.configError);
  const out = path.resolve(cwd, options.reportDir ?? '.tautest/review');
  const previous = readJsonFile<{ input: { path: string; sha256: string }; options?: { runner?: TestRunner; promptStyle?: PromptStyle }; contextHash: string | null; groups: Array<{ id: string }> }>(path.join(out, 'review.json'));
  const current = readReviewInput(cwd, previous.input.path);
  const contextHash = reviewContext(cwd, current.report, out, current.path);
  if (!contextHash) throw new CliError('Local review context is unavailable or stale. Decisions require matching source files and a project snapshot within the documented limits. Use the matching project checkout and re-run analyze, or refresh the Stryker report if source changed. See docs/STRYKER_REVIEW.md.', EXIT_CODES.configError);
  if (contextHash !== previous.contextHash || current.hash !== previous.input.sha256) throw new CliError('Analysis context changed. Re-run analyze before recording a review.', EXIT_CODES.configError);
  if (!previous.groups.some(g => g.id === groupId)) throw new CliError('Unknown review group. Use the full group id from review.json.', EXIT_CODES.configError);
  const notesPath = path.join(out, 'decisions.json');
  const notes = readNotes(notesPath).filter(n => n.groupId !== groupId);
  notes.push({ groupId, contextHash, decision: options.decision, reason: options.reason.trim(), reviewedAt: new Date().toISOString() });
  writeJsonFile(notesPath, notes);
  runAnalyzeCommand(cwd, { from: current.path, reportDir: out, runner: previous.options?.runner, promptStyle: previous.options?.promptStyle });
  return `Recorded manual ${options.decision} review. Raw Stryker statuses and score are unchanged.\n`;
}

function readNotes(file: string): ReviewNote[] {
  if (!existsSync(file)) return [];
  const notes = readJsonFile<ReviewNote[]>(file);
  if (!Array.isArray(notes) || notes.some(n => typeof n?.groupId !== 'string' || typeof n.contextHash !== 'string' || typeof n.reason !== 'string' || !['needs-test', 'equivalent', 'accepted-risk'].includes(n.decision))) throw new CliError('Invalid review decisions file.', EXIT_CODES.configError);
  return notes;
}

function reviewContext(root: string, report: StrykerMutationReport, out: string, input: string): string | null {
  try {
    root = path.resolve(root);
    for (const [file, value] of Object.entries(report.files)) assertFreshSource(root, file, value.source);
    const entries: string[] = [];
    let bytes = 0;
    const walk = (dir: string): void => {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        const isOutput = path.dirname(file) === out && ['report.json', 'report.md', 'review.json', 'fix-prompt.md', 'decisions.json'].includes(item.name);
        if (file === out || file === input || isOutput || item.isSymbolicLink() || ['node_modules', '.git', '.tautest', '.stryker-tmp', 'dist', 'coverage', 'reports'].includes(item.name) || item.name.startsWith('.env')) continue;
        if (item.isDirectory()) walk(file);
        else if (item.isFile()) {
          bytes += statSync(file).size;
          if (bytes > 64 * 1024 * 1024 || entries.length >= 20000) throw new Error('Context exceeds review snapshot budget.');
          const value = readFileSync(file);
          entries.push(`${path.relative(root, file).replace(/\\/g, '/')}:${reviewHash(value.toString('base64'))}`);
        }
      }
    };
    walk(root);
    return reviewHash(reviewHash(readFileSync(input, 'utf8')) + '\n' + entries.sort().join('\n'));
  } catch { return null; }
}
