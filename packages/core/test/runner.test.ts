import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createMutationRunnerRegistry,
  createMutmutAlphaRunnerPlugin,
  createPitAlphaRunnerPlugin,
  createStrykerRunnerPlugin,
  mutationSummaryFromNormalized,
  normalizeMutationSummary,
  normalizeMutmutAlphaReport,
  parsePitXmlReport
} from '../src';
import { parseStrykerMutationReport } from '../src/stryker/report-parser';

const fixturePath = path.join(import.meta.dirname, 'fixtures', 'stryker-mutation-report.json');

describe('runner plugin architecture', () => {
  it('registers and selects runner plugins by detection confidence', () => {
    const registry = createMutationRunnerRegistry([createMutmutAlphaRunnerPlugin(), createStrykerRunnerPlugin()]);

    expect(registry.list().map((plugin) => plugin.id)).toEqual(['mutmut-alpha', 'stryker-js']);
    expect(
      registry.select({
        rootDir: '/repo',
        packageJson: {
          devDependencies: {
            '@stryker-mutator/core': '^9.6.1'
          }
        },
        files: ['pyproject.toml']
      })?.id
    ).toBe('stryker-js');
    expect(registry.select({ rootDir: '/repo' }, 'mutmut-alpha')?.id).toBe('mutmut-alpha');
    expect(() => registry.register(createStrykerRunnerPlugin())).toThrow('already registered');
  });

  it('normalizes Stryker mutation summaries without changing legacy report counts', () => {
    const summary = parseStrykerMutationReport(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const normalized = normalizeMutationSummary({
      summary,
      runner: {
        id: 'stryker-js',
        name: 'StrykerJS',
        engineVersion: '9.6.1',
        language: 'typescript'
      },
      scope: {
        baseRef: 'HEAD'
      }
    });
    const legacy = mutationSummaryFromNormalized(normalized);

    expect(normalized.runner).toMatchObject({ id: 'stryker-js', language: 'typescript' });
    expect(normalized.summary).toMatchObject({
      mutationScore: 50,
      killed: 1,
      survived: 1,
      noCoverage: 1
    });
    expect(normalized.mutants.map((mutant) => mutant.status)).toEqual(['killed', 'survived', 'noCoverage', 'timeout']);
    expect(legacy).toMatchObject({
      score: summary.score,
      total: summary.total,
      killed: summary.killed,
      survived: summary.survived,
      noCoverage: summary.noCoverage
    });
    expect(legacy.survivingMutants.map((mutant) => mutant.status)).toEqual(['Survived', 'NoCoverage']);
  });

  it('exposes StrykerJS as an internal runner plugin', () => {
    const plugin = createStrykerRunnerPlugin();
    const detected = plugin.detect({
      rootDir: '/repo',
      packageJson: {
        devDependencies: {
          '@stryker-mutator/core': '^9.6.1'
        }
      }
    });
    const normalized = plugin.parseReport(fixturePath);

    expect(detected).toMatchObject({ supported: true, confidence: 'high' });
    expect(normalized.runner.id).toBe('stryker-js');
    expect(normalized.summary.total).toBe(4);
  });

  it('normalizes mutmut alpha fixture output with explicit limitations', () => {
    const normalized = normalizeMutmutAlphaReport({
      version: '3.0.0',
      mutants: [
        {
          id: 'm1',
          status: 'killed',
          filePath: 'src/discount.py',
          line: 4,
          mutatorName: 'conditional',
          original: 'age >= 65',
          replacement: 'age > 65'
        },
        {
          id: 'm2',
          status: 'survived',
          filePath: 'src/discount.py',
          line: 8
        }
      ]
    });

    expect(normalized.runner).toMatchObject({ id: 'mutmut-alpha', language: 'python' });
    expect(normalized.summary).toMatchObject({ total: 2, killed: 1, survived: 1 });
    expect(normalized.limitations.map((item) => item.code)).toContain('python-alpha-parser-only');
  });

  it('normalizes PIT alpha XML fixture output with explicit limitations', () => {
    const normalized = parsePitXmlReport(`<mutations>
  <mutation detected="true" status="KILLED">
    <sourceFile>Calculator.java</sourceFile>
    <mutatedClass>com.example.Calculator</mutatedClass>
    <mutatedMethod>add</mutatedMethod>
    <methodDescription>(II)I</methodDescription>
    <lineNumber>12</lineNumber>
    <mutator>org.pitest.mutationtest.engine.gregor.mutators.MathMutator</mutator>
    <description>Replaced integer addition with subtraction</description>
  </mutation>
  <mutation detected="false" status="SURVIVED">
    <sourceFile>Calculator.java</sourceFile>
    <lineNumber>18</lineNumber>
    <mutator>org.pitest.mutationtest.engine.gregor.mutators.ConditionalsBoundaryMutator</mutator>
    <description>changed conditional boundary</description>
  </mutation>
</mutations>`);

    expect(normalized.runner).toMatchObject({ id: 'pit-alpha', language: 'java' });
    expect(normalized.summary).toMatchObject({ total: 2, killed: 1, survived: 1 });
    expect(normalized.mutants[1]).toMatchObject({
      filePath: 'Calculator.java',
      line: 18,
      status: 'survived'
    });
    expect(normalized.limitations.map((item) => item.code)).toContain('java-alpha-parser-only');
  });

  it('detects Python and Java alpha projects conservatively', () => {
    expect(createMutmutAlphaRunnerPlugin().detect({ rootDir: '/repo', files: ['pyproject.toml'] })).toMatchObject({
      supported: true,
      confidence: 'medium'
    });
    expect(createPitAlphaRunnerPlugin().detect({ rootDir: '/repo', files: ['pom.xml'] })).toMatchObject({
      supported: true,
      confidence: 'medium'
    });
  });
});
