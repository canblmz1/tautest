import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { FlakinessAnalysisOptions, ReliabilityFinding, ReliabilityFindingSeverity, ReliabilityReport } from './types';

const TEST_FILE_PATTERN = /(^|[/\\])(__tests__|test|tests)([/\\]|$)|\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['.git', '.tautest', 'coverage', 'dist', 'build', 'node_modules']);

export function analyzeFlakiness(options: FlakinessAnalysisOptions): ReliabilityReport {
  const rootDir = path.resolve(options.cwd);
  const files = resolveAnalysisFiles(rootDir, options.paths);
  const findings = files.flatMap((filePath) => analyzeFile(rootDir, filePath));

  return buildReliabilityReport({
    kind: 'flakiness',
    rootDir,
    runner: options.runner,
    files: files.map((filePath) => relative(rootDir, filePath)),
    findings,
    createdAt: options.createdAt
  });
}

export function buildReliabilityReport(input: {
  kind: ReliabilityReport['kind'];
  rootDir: string;
  runner?: ReliabilityReport['scope']['runner'];
  files: string[];
  findings: ReliabilityFinding[];
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}): ReliabilityReport {
  const summary = summarizeFindings(input.findings);

  return {
    version: '1',
    schemaVersion: '1',
    kind: input.kind,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
    summary,
    scope: {
      rootDir: input.rootDir,
      runner: input.runner,
      files: [...input.files].sort()
    },
    findings: [...input.findings].sort(compareFindings),
    metadata: input.metadata
  };
}

function analyzeFile(rootDir: string, absolutePath: string): ReliabilityFinding[] {
  const filePath = relative(rootDir, absolutePath);
  const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  const findings: ReliabilityFinding[] = [];
  const topLevelMutableLines = findTopLevelMutableLines(lines);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('//')) {
      return;
    }

    if (/\b(fetch|axios\.\w+|request\(|http\.|https\.|userEvent\.)/.test(trimmed) && !/\b(await|return)\b/.test(trimmed)) {
      findings.push(
        finding({
          id: 'async-floating-operation',
          category: 'async-await',
          severity: 'high',
          confidence: 'medium',
          filePath,
          line: lineNumber,
          evidence: trimmed,
          title: 'Possible floating async operation',
          remediation: 'Await or return the async operation so the test runner observes failures before the test finishes.',
          tags: ['async', 'await']
        })
      );
    }

    if (/\b(setTimeout|setInterval|waitForTimeout|sleep|delay)\s*\(/.test(trimmed)) {
      findings.push(
        finding({
          id: 'real-time-wait',
          category: 'real-time',
          severity: 'medium',
          confidence: 'high',
          filePath,
          line: lineNumber,
          evidence: trimmed,
          title: 'Real-time wait in test code',
          remediation: 'Prefer fake timers or deterministic polling with bounded assertions instead of waiting on wall-clock time.',
          tags: ['timer', 'flaky']
        })
      );
    }

    if (/\b(Date\.now|new Date\s*\(|Math\.random|randomUUID|crypto\.randomUUID)\b/.test(trimmed)) {
      findings.push(
        finding({
          id: 'nondeterministic-input',
          category: 'nondeterminism',
          severity: 'medium',
          confidence: 'high',
          filePath,
          line: lineNumber,
          evidence: trimmed,
          title: 'Nondeterministic input in test path',
          remediation: 'Inject a clock/random provider or freeze time/randomness in test setup.',
          tags: ['time', 'random']
        })
      );
    }

    if (/\b(process\.env|readFileSync|writeFileSync|mkdtemp|tmpdir|localStorage|sessionStorage)\b/.test(trimmed)) {
      findings.push(
        finding({
          id: 'ambient-io-state',
          category: 'io',
          severity: 'low',
          confidence: 'medium',
          filePath,
          line: lineNumber,
          evidence: trimmed,
          title: 'Ambient IO or environment state',
          remediation: 'Isolate filesystem, browser storage, and environment mutations per test and restore them in teardown.',
          tags: ['io', 'state']
        })
      );
    }

    if (/\b(beforeAll|afterAll)\s*\(/.test(trimmed) && topLevelMutableLines.length > 0) {
      findings.push(
        finding({
          id: 'shared-state-lifecycle',
          category: 'shared-state',
          severity: 'medium',
          confidence: 'medium',
          filePath,
          line: lineNumber,
          evidence: trimmed,
          title: 'Suite-level lifecycle with mutable state',
          remediation: 'Prefer per-test setup with beforeEach/afterEach when state can leak across tests or workers.',
          tags: ['state', 'parallelism']
        })
      );
    }

    if (/\b(test|it)\.(only|skip|concurrent)\b/.test(trimmed)) {
      findings.push(
        finding({
          id: 'focused-or-concurrent-test-modifier',
          category: 'generic',
          severity: trimmed.includes('.only') ? 'high' : 'low',
          confidence: 'high',
          filePath,
          line: lineNumber,
          evidence: trimmed,
          title: 'Test modifier changes normal execution shape',
          remediation: 'Remove focused/skipped tests before CI; review concurrent tests for shared state and timing assumptions.',
          tags: ['runner', 'ci']
        })
      );
    }
  });

  return findings;
}

function resolveAnalysisFiles(rootDir: string, inputPaths?: string[]): string[] {
  if (inputPaths && inputPaths.length > 0) {
    return inputPaths.flatMap((inputPath) => resolveInputPath(rootDir, inputPath)).filter(isSupportedTestFile).sort();
  }

  return scanFiles(rootDir).filter(isSupportedTestFile).sort();
}

function resolveInputPath(rootDir: string, inputPath: string): string[] {
  const resolved = path.resolve(rootDir, inputPath);

  if (!existsSync(resolved)) {
    return [];
  }

  if (statSync(resolved).isDirectory()) {
    return scanFiles(resolved);
  }

  return [resolved];
}

function scanFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...scanFiles(path.join(dirPath, entry.name)));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(path.join(dirPath, entry.name));
    }
  }

  return files;
}

function isSupportedTestFile(filePath: string): boolean {
  return TEST_EXTENSIONS.has(path.extname(filePath)) && TEST_FILE_PATTERN.test(filePath);
}

function findTopLevelMutableLines(lines: string[]): number[] {
  let depth = 0;
  const mutableLines: number[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (depth === 0 && /^(let|var)\s+\w+/.test(trimmed)) {
      mutableLines.push(index + 1);
    }

    depth += countChar(line, '{');
    depth -= countChar(line, '}');
    depth = Math.max(0, depth);
  });

  return mutableLines;
}

function finding(input: Omit<ReliabilityFinding, 'riskScore'>): ReliabilityFinding {
  return {
    ...input,
    riskScore: severityRisk(input.severity)
  };
}

function severityRisk(severity: ReliabilityFindingSeverity): number {
  switch (severity) {
    case 'high':
      return 85;
    case 'medium':
      return 60;
    case 'low':
      return 35;
    default:
      return 10;
  }
}

function summarizeFindings(findings: ReliabilityFinding[]): ReliabilityReport['summary'] {
  const counts = {
    high: findings.filter((finding) => finding.severity === 'high').length,
    medium: findings.filter((finding) => finding.severity === 'medium').length,
    low: findings.filter((finding) => finding.severity === 'low').length,
    info: findings.filter((finding) => finding.severity === 'info').length
  };
  const riskScore = Math.min(100, findings.reduce((score, finding) => score + finding.riskScore, 0) / Math.max(1, findings.length) + counts.high * 5);

  return {
    riskScore: Number(riskScore.toFixed(2)),
    findingCount: findings.length,
    ...counts
  };
}

function compareFindings(a: ReliabilityFinding, b: ReliabilityFinding): number {
  return b.riskScore - a.riskScore || a.filePath.localeCompare(b.filePath) || (a.line ?? 0) - (b.line ?? 0);
}

function countChar(value: string, char: string): number {
  return [...value].filter((item) => item === char).length;
}

function relative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}
