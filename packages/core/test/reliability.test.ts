import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeFlakiness } from '../src/reliability/flakiness';
import { buildReliabilityHtmlReport } from '../src/reliability/report';
import { buildTestScaffold } from '../src/reliability/scaffold';
import { buildTimeTravelHelper } from '../src/reliability/time-travel';
import { buildWatchSelectionReport } from '../src/reliability/watch';

describe('reliability flakiness analysis', () => {
  it('scores async, timer, and nondeterministic test patterns', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-flaky-'));
    const testPath = path.join(root, 'src', 'service.test.ts');
    mkdirSync(path.dirname(testPath), { recursive: true });
    writeFileSync(
      testPath,
      `import { it } from 'vitest';

it('is risky', () => {
  fetch('/api');
  setTimeout(() => {}, 10);
  Math.random();
});
`
    );

    const report = analyzeFlakiness({ cwd: root });

    expect(report.kind).toBe('flakiness');
    expect(report.summary.findingCount).toBeGreaterThanOrEqual(3);
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(['async-floating-operation', 'real-time-wait', 'nondeterministic-input'])
    );
    expect(report.summary.riskScore).toBeGreaterThan(50);
  });
});

describe('watch selection', () => {
  it('selects tests that import changed source files', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-watch-'));
    mkdirSync(path.join(root, 'src'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'math.ts'), 'export function add() { return 1; }\n');
    writeFileSync(path.join(root, 'src', 'math.test.ts'), "import { add } from './math';\nadd();\n");

    const report = buildWatchSelectionReport({
      cwd: root,
      changedFiles: ['src/math.ts']
    });

    expect(report.metadata.affectedTests).toEqual(['src/math.test.ts']);
    expect(report.metadata.commandHints[0]).toContain('vitest run');
  });
});

describe('scaffold generation', () => {
  it('generates an experimental pytest scaffold for Python services', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'tautest-scaffold-'));
    const sourcePath = path.join(root, 'app', 'service.py');
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(
      sourcePath,
      `import requests

def load_user():
    return requests.get("https://example.test").json()
`
    );

    const scaffold = buildTestScaffold({
      cwd: root,
      filePath: 'app/service.py',
      language: 'python',
      framework: 'pytest'
    });

    expect(scaffold.suggestedTestPath).toBe('tests/test_service.py');
    expect(scaffold.detected.dependencies).toContain('requests');
    expect(scaffold.code).toContain('def test_load_user_primary_behavior');
    expect(scaffold.warnings[0]).toContain('experimental');
  });
});

describe('time-travel helper', () => {
  it('uses runner-specific fake timer APIs', () => {
    expect(buildTimeTravelHelper({ runner: 'vitest' })).toContain('vi.setSystemTime');
    expect(buildTimeTravelHelper({ runner: 'jest' })).toContain('jest.setSystemTime');
  });
});

describe('reliability HTML report', () => {
  it('embeds report data and findings', () => {
    const report = analyzeFlakiness({
      cwd: mkdtempSync(path.join(tmpdir(), 'tautest-empty-flaky-')),
      paths: []
    });
    const html = buildReliabilityHtmlReport(report);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Tautest reliability report');
    expect(html).toContain('tautest-reliability-report-data');
  });
});
