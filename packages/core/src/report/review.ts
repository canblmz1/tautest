import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseStrykerMutationReport, type StrykerMutationReport } from '../stryker/report-parser';
import type { SurvivingMutant } from '../types';

const point = z.object({ line: z.number().int().min(1), column: z.number().int().min(1) });
const mutant = z.object({
  id: z.string().optional(), status: z.string().min(1), mutatorName: z.string().min(1), replacement: z.string(),
  location: z.object({ start: point, end: point }), description: z.string().optional(),
  coveredBy: z.array(z.string()).optional(), killedBy: z.array(z.string()).optional(),
  testsCompleted: z.number().int().min(0).optional()
}).passthrough();
const schema = z.object({
  schemaVersion: z.string().optional(), projectRoot: z.string().optional(), thresholds: z.unknown().optional(),
  framework: z.object({ name: z.string().optional(), version: z.string().optional() }).passthrough().optional(),
  config: z.object({
    testRunner: z.string().optional(), packageManager: z.string().optional(), coverageAnalysis: z.string().optional(),
    mutate: z.array(z.string()).optional(), reporters: z.array(z.string()).optional()
  }).passthrough().optional(),
  files: z.record(z.object({ source: z.string(), mutants: z.array(mutant) }).passthrough()),
  testFiles: z.record(z.object({ tests: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()).optional() }).passthrough()).optional()
}).passthrough();

/** Validate imported data without evaluating its config or consulting the filesystem. */
export function validateStrykerReviewReport(input: unknown): StrykerMutationReport {
  const report = schema.parse(input);
  for (const [file, entry] of Object.entries(report.files)) {
    const lines = entry.source.split(/\r?\n/);
    const ids = new Set<string>();
    for (const m of entry.mutants) {
      if (m.id !== undefined && ids.has(m.id)) throw new Error(`Duplicate mutant id ${m.id} in ${file}.`);
      if (m.id !== undefined) ids.add(m.id);
      const { start, end } = m.location;
      if (start.line > end.line || (start.line === end.line && start.column > end.column) ||
          start.column > (lines[start.line - 1]?.length ?? -1) + 1 || end.column > (lines[end.line - 1]?.length ?? -1) + 1) {
        throw new Error(`Invalid source location for mutant ${m.id ?? '(no id)'} in ${file}.`);
      }
    }
  }
  // Retain the existing zero-executed-tests safeguard for imported reports too.
  parseStrykerMutationReport(report);
  return report;
}

export function reviewHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export type ReviewDecision = 'needs-test' | 'equivalent' | 'accepted-risk';
export interface ReviewNote {
  groupId: string;
  contextHash: string;
  decision: ReviewDecision;
  reason: string;
  reviewedAt: string;
}
export interface ReviewGroup {
  id: string;
  filePath: string;
  line: number;
  endLine: number;
  original: string;
  mutants: SurvivingMutant[];
  review: ReviewNote | null;
  staleReview: boolean;
}

/** Group by the same expression, not by an unproven claim of equivalent behavior. */
export function groupReviewMutants(mutants: SurvivingMutant[], contextHash: string | null, notes: ReviewNote[] = []): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const m of mutants) {
    const id = reviewHash(JSON.stringify([m.filePath, m.location, m.original]));
    let group = groups.get(id);
    if (!group) {
      const note = notes.find(n => n.groupId === id);
      group = {
        id, filePath: m.filePath, line: m.line, endLine: m.location.end.line, original: m.original, mutants: [],
        review: note && contextHash !== null && note.contextHash === contextHash ? note : null,
        staleReview: Boolean(note && (contextHash === null || note.contextHash !== contextHash))
      };
      groups.set(id, group);
    }
    group.mutants.push(m);
  }
  return [...groups.values()].sort((a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line);
}
