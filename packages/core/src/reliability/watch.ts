import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { buildReliabilityReport } from './flakiness';
import type { ReliabilityFinding, WatchSelectionOptions, WatchSelectionReport } from './types';

const DEFAULT_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
const DEFAULT_TEST_PATTERN = /(^|[/\\])(__tests__|test|tests)([/\\]|$)|\.(test|spec)\.[cm]?[tj]sx?$/;
const IGNORED_DIRS = new Set(['.git', '.tautest', 'coverage', 'dist', 'build', 'node_modules']);

export function buildWatchSelectionReport(options: WatchSelectionOptions): WatchSelectionReport {
  const rootDir = path.resolve(options.cwd);
  const sourceExtensions = options.sourceExtensions ?? DEFAULT_SOURCE_EXTENSIONS;
  const testPattern = options.testPattern ?? DEFAULT_TEST_PATTERN;
  const allFiles = scanFiles(rootDir).filter((filePath) => sourceExtensions.includes(path.extname(filePath)));
  const graph = buildImportGraph(rootDir, allFiles, sourceExtensions);
  const changedFiles = options.changedFiles.map((filePath) => normalizeRelative(filePath)).filter((filePath) => sourceExtensions.includes(path.extname(filePath)));
  const affectedTests = selectAffectedTests({
    rootDir,
    allFiles,
    changedFiles,
    graph,
    testPattern
  });
  const warnings = buildWarnings(changedFiles, affectedTests);
  const commandHints = buildCommandHints(affectedTests);
  const findings = buildFindings(changedFiles, affectedTests, warnings);

  return {
    ...buildReliabilityReport({
      kind: 'watch',
      rootDir,
      files: changedFiles,
      findings,
      createdAt: options.createdAt,
      metadata: {
        changedFiles,
        affectedTests,
        graphNodeCount: Object.keys(graph).length,
        commandHints,
        warnings
      }
    }),
    kind: 'watch',
    metadata: {
      changedFiles,
      affectedTests,
      graphNodeCount: Object.keys(graph).length,
      commandHints,
      warnings
    }
  };
}

function buildImportGraph(rootDir: string, files: string[], sourceExtensions: string[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const filePath of files) {
    const relativePath = relative(rootDir, filePath);
    const imports = extractImports(readFileSync(filePath, 'utf8'))
      .map((specifier) => resolveImport(rootDir, filePath, specifier, sourceExtensions))
      .filter((resolved): resolved is string => Boolean(resolved));

    graph[relativePath] = imports;
  }

  return graph;
}

function selectAffectedTests(input: {
  rootDir: string;
  allFiles: string[];
  changedFiles: string[];
  graph: Record<string, string[]>;
  testPattern: RegExp;
}): string[] {
  const tests = input.allFiles.map((filePath) => relative(input.rootDir, filePath)).filter((filePath) => input.testPattern.test(filePath));
  const changed = new Set(input.changedFiles);
  const affected = new Set<string>();

  for (const testFile of tests) {
    const imports = collectTransitiveImports(testFile, input.graph);

    if (imports.some((importPath) => changed.has(importPath)) || hasSiblingSourceChange(testFile, changed)) {
      affected.add(testFile);
    }
  }

  return [...affected].sort();
}

function collectTransitiveImports(filePath: string, graph: Record<string, string[]>): string[] {
  const visited = new Set<string>();
  const queue = [...(graph[filePath] ?? [])];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    queue.push(...(graph[current] ?? []));
  }

  return [...visited];
}

function hasSiblingSourceChange(testFile: string, changedFiles: Set<string>): boolean {
  const parsed = path.posix.parse(testFile);
  const base = parsed.name.replace(/\.(test|spec)$/, '');

  for (const changedFile of changedFiles) {
    const changed = path.posix.parse(changedFile);

    if (changed.dir === parsed.dir && changed.name === base) {
      return true;
    }
  }

  return false;
}

function buildCommandHints(affectedTests: string[]): string[] {
  if (affectedTests.length === 0) {
    return ['Run the normal test suite because no affected tests were selected by the static graph.'];
  }

  const testArgs = affectedTests.map((filePath) => JSON.stringify(filePath)).join(' ');

  return [`vitest run ${testArgs}`, `jest ${testArgs}`];
}

function buildWarnings(changedFiles: string[], affectedTests: string[]): string[] {
  const warnings: string[] = [];

  if (changedFiles.length === 0) {
    warnings.push('No changed JS/TS source files were provided for watch selection.');
  }

  if (changedFiles.length > 0 && affectedTests.length === 0) {
    warnings.push('Static import graph selected no tests; dynamic imports, path aliases, or generated code may require a full suite run.');
  }

  return warnings;
}

function buildFindings(changedFiles: string[], affectedTests: string[], warnings: string[]): ReliabilityFinding[] {
  if (warnings.length === 0) {
    return [];
  }

  return warnings.map((warning, index) => ({
    id: `watch-warning-${index + 1}`,
    category: 'dependency-graph',
    severity: affectedTests.length === 0 && changedFiles.length > 0 ? 'medium' : 'info',
    confidence: 'medium',
    riskScore: affectedTests.length === 0 && changedFiles.length > 0 ? 60 : 10,
    filePath: '.',
    title: 'Watch selection warning',
    evidence: warning,
    remediation: affectedTests.length === 0 ? 'Run the normal test suite or add explicit test selectors until the graph covers this project shape.' : 'Review watch selection inputs.',
    tags: ['watch', 'dependency-graph']
  }));
}

function extractImports(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+[^'"]+\s+from\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) {
        specifiers.push(match[1]);
      }
    }
  }

  return specifiers;
}

function resolveImport(rootDir: string, importerPath: string, specifier: string, sourceExtensions: string[]): string | undefined {
  if (!specifier.startsWith('.')) {
    return undefined;
  }

  const basePath = path.resolve(path.dirname(importerPath), specifier);
  const candidates = [
    basePath,
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) => path.join(basePath, `index${extension}`))
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());

  return resolved ? relative(rootDir, resolved) : undefined;
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

function normalizeRelative(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function relative(rootDir: string, filePath: string): string {
  return normalizeRelative(path.relative(rootDir, filePath));
}
