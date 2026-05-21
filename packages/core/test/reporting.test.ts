import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFixPrompt } from '../src/prompt/builder';
import { buildJsonReport } from '../src/report/json';
import { buildMarkdownReport } from '../src/report/markdown';
import { buildTerminalSummary } from '../src/report/terminal';
import { buildMutationInsight } from '../src/report/insights';
import { getActionableMutants, getMutationVerdict, selectTopMutants } from '../src/score/score';
import { extractOriginal, parseStrykerMutationReport } from '../src/stryker/report-parser';
import type { MutationLocation } from '../src/types';

const fixturePath = path.join(import.meta.dirname, 'fixtures', 'stryker-mutation-report.json');

describe('Stryker report parser', () => {
  it('parses summary counts and surviving mutants from Stryker JSON', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));

    expect(summary).toMatchObject({
      score: 50,
      total: 4,
      killed: 1,
      survived: 1,
      noCoverage: 1,
      timeout: 1,
      survivingMutants: [
        {
          filePath: 'src/discount.ts',
          line: 2,
          mutatorName: 'EqualityOperator',
          original: 'age >= 65',
          replacement: 'age > 65',
          coveringTests: [
            {
              filePath: 'src/discount.test.ts',
              name: 'calculateDiscount applies the senior discount for customers above 65'
            }
          ]
        }
      ],
      stryker: {
        frameworkName: 'StrykerJS',
        frameworkVersion: '9.6.1'
      }
    });
  });

  it('extracts original source using Stryker one-based columns', () => {
    const location: MutationLocation = {
      start: { line: 1, column: 7 },
      end: { line: 1, column: 16 }
    };

    expect(extractOriginal('  if (age >= 65) {\n}', location)).toBe('age >= 65');
  });
});

describe('score module', () => {
  it('produces verdicts and selects top mutants', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));

    expect(getMutationVerdict(summary, { strong: 80, mixed: 60 })).toMatchObject({
      verdict: 'WEAK',
      score: 50
    });
    expect(selectTopMutants(summary.allMutants, 2).map((mutant) => mutant.status)).toEqual(['Survived', 'NoCoverage']);
    expect(getActionableMutants(summary).map((mutant) => mutant.status)).toEqual(['Survived', 'NoCoverage']);
  });
});

describe('report builders', () => {
  it('builds markdown, json, and terminal reports', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const score = getMutationVerdict(summary);
    const topMutants = selectTopMutants(getActionableMutants(summary), 10);

    const markdown = buildMarkdownReport({
      summary,
      score,
      topMutants,
      threshold: 60,
      runner: 'vitest',
      runtimeMs: 1250,
      mutatePatterns: ['src/discount.ts:2-2']
    });

    expect(markdown).toContain('| `src/discount.ts` | 2 | EqualityOperator | age >= 65 | age > 65 |');
    expect(markdown).toContain('## Mutant Details');
    expect(markdown).toContain('Likely missing behavior');
    expect(markdown).toContain('The exact boundary value 65 is not protected');
    expect(markdown).toContain('Suggested test idea');
    const jsonReport = buildJsonReport({ summary, score, topMutants, createdAt: new Date('2026-05-10T00:00:00Z'), threshold: 60 });
    expect(jsonReport).toMatchObject({
      version: '1',
      schemaVersion: '1',
      createdAt: '2026-05-10T00:00:00.000Z',
      summary: {
        verdict: 'WEAK',
        threshold: 60
      }
    });
    expect(jsonReport.surviving[0]?.insight.suggestedTestIdea).toContain('boundary');
    expect(jsonReport.surviving[0]?.insight).toMatchObject({
      category: 'boundary',
      missingBehavior: expect.stringContaining('exact boundary value 65')
    });
    const terminal = buildTerminalSummary(summary, score, {
      threshold: 60,
      runner: 'vitest',
      runtimeMs: 1250,
      fixPromptPath: '.tautest/fix-prompt.md',
      topMutants
    });
    expect(terminal).toContain('Tautest: WEAK');
    expect(terminal).toContain('exact boundary value 65');
    expect(terminal).toContain('Fix prompt: .tautest/fix-prompt.md');
    expect(terminal.split('\n').length).toBeLessThanOrEqual(25);
  });

  it('explains equality boundary mutants as missing boundary behavior', () => {
    const insight = buildMutationInsight({
      filePath: 'src/discount.ts',
      line: 2,
      mutatorName: 'EqualityOperator',
      original: 'age >= 65',
      replacement: 'age > 65',
      status: 'Survived',
      location: {
        start: { line: 2, column: 7 },
        end: { line: 2, column: 16 }
      }
    });

    expect(insight).toMatchObject({
      category: 'boundary',
      missingBehavior: expect.stringContaining('exact boundary value 65'),
      suggestedTestIdea: expect.stringContaining('exact value 65')
    });
  });
});

describe('prompt builder', () => {
  it('builds a test-only AI prompt from surviving mutants', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));

    const prompt = buildFixPrompt({
      mutants: getActionableMutants(summary),
      testRunner: 'vitest',
      commands: ['pnpm test', 'pnpm tautest'],
      maxMutants: 1,
      style: 'codex'
    });

    expect(prompt).toContain('# Tautest Test-Fix Prompt');
    expect(prompt).toContain('Do not change production code.');
    expect(prompt).toContain('Only edit or add test files.');
    expect(prompt).toContain('Do not write filler tests such as expect(true).toBe(true).');
    expect(prompt).toContain('Do not add new dependencies.');
    expect(prompt).toContain('If you find a real production bug, stop and report it');
    expect(prompt).toContain('mutation score increased');
    expect(prompt).toContain('Likely missing behavior');
    expect(prompt).toContain('exact boundary value 65');
    expect(prompt).toContain('Suggested test idea');
    expect(prompt).toContain('src/discount.test.ts - calculateDiscount applies the senior discount for customers above 65');
  });

  it('builds an OpenCode-oriented prompt style', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));

    const prompt = buildFixPrompt({
      mutants: getActionableMutants(summary),
      testRunner: 'vitest',
      style: 'opencode'
    });

    expect(prompt).toContain('You are OpenCode working in an existing repository.');
    expect(prompt).toContain('Keep the patch test-only');
    expect(prompt).toContain('Do not change production code.');
  });

  it('generates useful deterministic prompts for the phase 4 eval fixtures', () => {
    const evalDir = path.join(import.meta.dirname, 'fixtures', 'prompt-eval');
    const prompts = readdirSync(evalDir)
      .filter((fileName) => fileName.endsWith('.json'))
      .map((fileName) => {
        const summary = parseStrykerMutationReport(JSON.parse(readFileSync(path.join(evalDir, fileName), 'utf8')));
        return {
          fileName,
          prompt: buildFixPrompt({
            mutants: getActionableMutants(summary),
            testRunner: 'vitest',
            commands: ['pnpm test', 'pnpm exec tautest run --base HEAD'],
            style: 'agent'
          })
        };
      });

    expect(prompts).toHaveLength(5);
    for (const { prompt } of prompts) {
      expect(prompt).toContain('Do not change production code.');
      expect(prompt).toContain('Do not write filler tests such as expect(true).toBe(true).');
      expect(prompt).toContain('Suggested test idea');
      expect(prompt).toContain('Run Tautest again.');
    }
    expect(prompts.find((item) => item.fileName === 'boundary-condition.json')?.prompt).toContain('exact value 65');
    expect(prompts.find((item) => item.fileName === 'boolean-condition.json')?.prompt).toContain('truth-table');
    expect(prompts.find((item) => item.fileName === 'arithmetic-operator.json')?.prompt).toContain('exact expected numeric result');
    expect(prompts.find((item) => item.fileName === 'no-coverage.json')?.prompt).toContain('not executed by the current test suite');
  });
});
