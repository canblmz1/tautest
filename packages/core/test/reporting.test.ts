import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { buildFixPrompt } from '../src/prompt/builder';
import { buildHtmlReport } from '../src/report/html';
import { buildJsonReport } from '../src/report/json';
import { buildMarkdownReport } from '../src/report/markdown';
import { buildTerminalSummary } from '../src/report/terminal';
import { buildMutationInsight } from '../src/report/insights';
import { getActionableMutants, getMutationVerdict, selectTopMutants } from '../src/score/score';
import { extractOriginal, parseStrykerMutationReport } from '../src/stryker/report-parser';
import type { MutationLocation } from '../src/types';

const fixturePath = path.join(import.meta.dirname, 'fixtures', 'stryker-mutation-report.json');
const schemaPath = path.resolve(import.meta.dirname, '..', '..', '..', 'docs', 'report.schema.json');

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
  it('preserves raw NoCoverage findings and score while requiring coverage diagnosis before adding tests', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const score = getMutationVerdict(summary);
    const topMutants = getActionableMutants(summary);
    const rawMutant = summary.allMutants.find((mutant) => mutant.id === '2')!;
    const report = buildJsonReport({ summary, score, topMutants, threshold: 60 });
    const mutant = report.surviving.find((entry) => entry.id === '2')!;

    expect(report.summary).toMatchObject({ mutationScore: 50, threshold: 60, verdict: 'WEAK', total: 4, killed: 1, survived: 1, noCoverage: 1, timeout: 1 });
    expect(mutant).toMatchObject(rawMutant);
    expect(mutant.status).toBe('NoCoverage');
    expect(mutant.location).toEqual({ start: { line: 3, column: 5 }, end: { line: 3, column: 27 } });
    expect(mutant.insight).toEqual({
      category: 'coverage',
      missingBehavior: 'Stryker recorded no test coverage for this mutant around src/discount.ts:3 in this run.',
      whyThisMatters: 'NoCoverage does not by itself prove a missing test. Test selection, configuration or coverage attribution may explain the result.',
      suggestedTestIdea: 'Before adding tests, verify test selection, configuration and coverage attribution. If a missing test is confirmed, add a focused test around src/discount.ts:3 that asserts the observable result.'
    });
    expect(report.aiSignals.validationLoop[0]).toContain('verify test selection, configuration and coverage attribution');
    expect(report.aiSignals.validationLoop[0]).toContain('stop before adding tests');
    for (const output of [
      buildMarkdownReport({ summary, score, topMutants }),
      buildHtmlReport(report),
      buildTerminalSummary(summary, score, { topMutants })
    ]) {
      expect(output).toContain('Stryker recorded no test coverage');
      expect(output).not.toContain('not executed by the current test suite');
    }
    expect(validateReportSchema(report)).toEqual([]);
  });

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
      mutatePatterns: ['src/discount.ts:2-2'],
      metrics: {
        runtimeMs: 1250,
        changedFileCount: 2,
        changedSourceFileCount: 1,
        changedSourceLineCount: 1,
        mutatedFileCount: 1,
        mutatePatternCount: 1,
        partial: false,
        stageMs: {
          scopeMs: 10,
          configMs: 20,
          mutationMs: 1250,
          parseMs: 30,
          reportMs: 40
        }
      },
      strykerConfigDiagnostics: [
        {
          severity: 'warning',
          key: 'timeoutMS',
          message: 'Tautest run settings override Stryker `timeoutMS` from stryker.userConfig.',
          suggestion: 'Move supported settings into the Tautest stryker config block.'
        }
      ]
    });

    expect(markdown).toContain('| `src/discount.ts` | 2 | EqualityOperator | age >= 65 | age > 65 |');
    expect(markdown).toContain('Changed production lines: **1**');
    expect(markdown).toContain('Mutation stage: **1.3s**');
    expect(markdown).toContain('## Stryker Config Diagnostics');
    expect(markdown).toContain('## Mutant Details');
    expect(markdown).toContain('Likely missing behavior');
    expect(markdown).toContain('The exact boundary value 65 may not be protected');
    expect(markdown).toContain('Suggested test idea');
    const jsonReport = buildJsonReport({
      summary,
      score,
      topMutants,
      createdAt: new Date('2026-05-10T00:00:00Z'),
      threshold: 60,
      metrics: {
        changedSourceLineCount: 1,
        stageMs: {
          scopeMs: 10,
          configMs: 20,
          mutationMs: 1250,
          parseMs: 30,
          reportMs: 40
        }
      },
      diagnostics: {
        strykerConfig: [
          {
            severity: 'warning',
            key: 'timeoutMS',
            message: 'Tautest run settings override Stryker `timeoutMS` from stryker.userConfig.',
            suggestion: 'Move supported settings into the Tautest stryker config block.'
          }
        ]
      }
    });
    expect(jsonReport).toMatchObject({
      version: '1',
      schemaVersion: '1',
      createdAt: '2026-05-10T00:00:00.000Z',
      summary: {
        verdict: 'WEAK',
        threshold: 60
      },
      metrics: {
        changedSourceLineCount: 1,
        stageMs: {
          mutationMs: 1250
        }
      },
      diagnostics: {
        strykerConfig: [
          {
            key: 'timeoutMS'
          }
        ]
      }
    });
    expect(jsonReport.surviving[0]?.insight.suggestedTestIdea).toContain('boundary');
    expect(jsonReport.surviving[0]?.insight).toMatchObject({
      category: 'boundary',
      missingBehavior: expect.stringContaining('exact boundary value 65')
    });
    expect(validateReportSchema(jsonReport)).toEqual([]);
    const html = buildHtmlReport(jsonReport);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('data-tautest-schema-version="1"');
    expect(html).toContain('Tautest mutation report');
    expect(html).toContain('data-tautest-file="src/discount.ts"');
    expect(html).toContain('age &gt; 65');
    expect(html).toContain('"surviving"');
    const terminal = buildTerminalSummary(summary, score, {
      threshold: 60,
      runner: 'vitest',
      runtimeMs: 1250,
      fixPromptPath: '.tautest/fix-prompt.md',
      metrics: {
        changedSourceLineCount: 1,
        mutatePatternCount: 1,
        stageMs: {
          scopeMs: 10,
          configMs: 20,
          mutationMs: 1250,
          parseMs: 30,
          reportMs: 40
        }
      },
      strykerConfigDiagnostics: [
        {
          severity: 'warning',
          key: 'timeoutMS',
          message: 'Tautest run settings override Stryker `timeoutMS` from stryker.userConfig.',
          suggestion: 'Move supported settings into the Tautest stryker config block.'
        }
      ],
      topMutants
    });
    expect(terminal).toContain('Tautest: WEAK');
    expect(terminal).toContain('Changed lines: 1');
    expect(terminal).toContain('Stages: scope 10ms | config 20ms | mutation 1.3s | parse 30ms | report 40ms');
    expect(terminal).toContain('Stryker config diagnostics:');
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

  it('classifies ConditionalExpression survivors as branch mutants even though their replacement is a boolean literal', () => {
    const onComparison = buildMutationInsight({
      filePath: 'src/discount.ts',
      line: 2,
      mutatorName: 'ConditionalExpression',
      original: 'age >= 65',
      replacement: 'true',
      status: 'Survived',
      location: { start: { line: 2, column: 7 }, end: { line: 2, column: 16 } }
    });
    const onNullCheck = buildMutationInsight({
      filePath: 'src/utils/diff.ts',
      line: 46,
      mutatorName: 'ConditionalExpression',
      original: 'obj === null',
      replacement: 'false',
      status: 'Survived',
      location: { start: { line: 46, column: 7 }, end: { line: 46, column: 19 } }
    });

    expect(onComparison.category).toBe('branch');
    expect(onNullCheck.category).toBe('branch');
  });

  it('does not claim a generic survivor definitely changed observable behavior, since it may be equivalent', () => {
    const insight = buildMutationInsight({
      filePath: 'src/hash.ts',
      line: 10,
      mutatorName: 'BlockStatement',
      original: 'doFastPath()',
      replacement: '',
      status: 'Survived',
      location: {
        start: { line: 10, column: 1 },
        end: { line: 10, column: 14 }
      }
    });

    expect(insight.category).toBe('generic');
    expect(insight.missingBehavior).not.toMatch(/behavior changed/i);
    expect(insight.missingBehavior).toContain('may be an equivalent mutant');
    expect(insight.suggestedTestIdea).toContain('documented Stryker ignore');
  });

  it('keeps generated report.json compatible with docs/report.schema.json', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const jsonReport = buildJsonReport({
      summary,
      score: getMutationVerdict(summary),
      topMutants: getActionableMutants(summary),
      createdAt: new Date('2026-05-10T00:00:00Z'),
      threshold: 60,
      scope: {
        baseRef: 'origin/main',
        runner: 'vitest',
        mutatePatterns: ['src/discount.ts:2-2']
      },
      metrics: {
        runtimeMs: 1250,
        changedFileCount: 2,
        changedSourceFileCount: 1,
        changedSourceLineCount: 1,
        mutatedFileCount: 1,
        mutatePatternCount: 1,
        partial: false,
        stageMs: {
          scopeMs: 10,
          configMs: 20,
          mutationMs: 1250,
          parseMs: 30,
          reportMs: 40
        }
      },
      diagnostics: {
        strykerConfig: []
      },
      aiSignals: {
        promptStyle: 'codex',
        commands: ['pnpm test', 'pnpm exec tautest run --base origin/main']
      }
    });

    expect(validateReportSchema(jsonReport)).toEqual([]);
  });
});

describe('prompt builder', () => {
  it.each([undefined, ['Run the existing Stryker command and analyze the refreshed report.']])(
    'diagnoses NoCoverage before requesting a test patch, including custom validation loops (%s)',
    (validationLoop) => {
      const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
      const mutants = getActionableMutants(summary);
      const prompt = buildFixPrompt({ mutants, testRunner: 'vitest', validationLoop });
      const report = buildJsonReport({ summary, score: getMutationVerdict(summary), topMutants: mutants, aiSignals: { validationLoop } });
      const objective = prompt.split('## Objective')[1]!.split('## Hard Rules')[0]!;
      const loop = prompt.split('## Validation Loop')[1]!.split('## Commands')[0]!;

      expect(objective).toContain('Review the listed mutants before deciding whether a test change is needed.');
      expect(objective).toContain('For NoCoverage, verify test selection, configuration and coverage attribution first.');
      expect(loop).toContain('1. For NoCoverage, first verify test selection, configuration and coverage attribution.');
      expect(loop).toContain('stop before adding tests');
      expect(loop).toContain('2. Only after confirming a missing test, add or strengthen the smallest test that observes the behavioral difference.');
      expect(report.aiSignals.validationLoop[0]).toBe(loop.trim().split('\n')[0]!.slice(3));
      expect(prompt).toContain('- Status: NoCoverage');
      expect(prompt).toContain('Before adding tests, verify test selection, configuration and coverage attribution.');
      expect(prompt).not.toContain('not executed by the current test suite');
      expect(prompt).not.toContain('listed surviving or uncovered mutants are killed');
    }
  );

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
    expect(prompts.find((item) => item.fileName === 'no-coverage.json')?.prompt).toContain('Stryker recorded no test coverage');
    // `subtotal >= 100` forced to `false` is a branch mutant, not a boundary shift.
    expect(prompts.find((item) => item.fileName === 'conditional-expression.json')?.prompt).toContain('One branch direction may be forced');
    expect(prompts.find((item) => item.fileName === 'conditional-expression.json')?.prompt).not.toContain('exact boundary value');
  });
});

function validateReportSchema(report: unknown): string[] {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  const validate = ajv.compile(schema);
  const jsonLikeReport = JSON.parse(JSON.stringify(report)) as unknown;

  if (validate(jsonLikeReport)) {
    return [];
  }

  return (validate.errors ?? []).map((error) => `${error.instancePath} ${error.message}`);
}

describe('report.json schema contract', () => {
  it('rejects a report with a missing schemaVersion', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const report = buildJsonReport({
      summary,
      score: getMutationVerdict(summary),
      topMutants: [],
      createdAt: new Date('2026-05-10T00:00:00Z'),
      threshold: 60
    });

    const mutated = { ...report, schemaVersion: undefined } as Record<string, unknown>;
    delete mutated['schemaVersion'];
    const errors = validateReportSchema(mutated);

    expect(errors.some((error) => error.includes('schemaVersion'))).toBe(true);
  });

  it('rejects a report with an unexpected schemaVersion value', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const report = buildJsonReport({
      summary,
      score: getMutationVerdict(summary),
      topMutants: [],
      createdAt: new Date('2026-05-10T00:00:00Z'),
      threshold: 60
    });

    const mutated = { ...report, schemaVersion: '999' } as Record<string, unknown>;
    const errors = validateReportSchema(mutated);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a report with an invalid mutationScore range', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const report = buildJsonReport({
      summary,
      score: getMutationVerdict(summary),
      topMutants: [],
      createdAt: new Date('2026-05-10T00:00:00Z'),
      threshold: 60
    });

    const mutated = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
    (mutated['summary'] as Record<string, unknown>)['mutationScore'] = 150;
    const errors = validateReportSchema(mutated);

    expect(errors.some((error) => error.includes('mutationScore'))).toBe(true);
  });

  it('ide-report-consumer sample-report.json passes schema validation', () => {
    const samplePath = path.resolve(import.meta.dirname, '..', '..', '..', 'examples', 'ide-report-consumer', 'sample-report.json');
    const sampleReport = JSON.parse(readFileSync(samplePath, 'utf8')) as unknown;
    const errors = validateReportSchema(sampleReport);

    expect(errors).toEqual([]);
  });
});
