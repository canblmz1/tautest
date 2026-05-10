import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Stryker } from '@stryker-mutator/core';
import type { PartialStrykerOptions } from '@stryker-mutator/api/core';

type Args = {
  baseRef: string;
};

type ChangedRange = {
  start: number;
  end: number;
};

type ChangedFile = {
  filePath: string;
  lines: Set<number>;
  ranges: ChangedRange[];
};

type StrykerRun = {
  mode: 'programmatic' | 'cli-fallback';
  fallbackReason?: string;
};

type MutationReport = {
  files: Record<string, MutationFile>;
};

type MutationFile = {
  source: string;
  mutants: MutationMutant[];
};

type MutationMutant = {
  id?: string;
  status: string;
  mutatorName: string;
  replacement: string;
  description?: string;
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

type FlatMutant = MutationMutant & {
  filePath: string;
  original: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = 'examples/vitest-basic/src';
const outputDir = path.join(repoRoot, '.tautest', 'prototype');
const mutationJsonPath = path.join(outputDir, 'mutation.json');
const reportPath = path.join(outputDir, 'report.md');
const promptPath = path.join(outputDir, 'fix-prompt.md');
const fallbackConfigPath = path.join(outputDir, 'stryker.config.mjs');

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const diff = gitDiff(args.baseRef);
  const changedFiles = parseChangedFiles(diff);

  if (changedFiles.length === 0) {
    throw new Error(
      `No changed source lines found under ${sourceRoot}. Make a production source change or pass a different --base ref.`
    );
  }

  const mutatePatterns = changedFiles.flatMap((file) =>
    file.ranges.map((range) => `${file.filePath}:${range.start}-${range.end}`)
  );

  const strykerConfig = buildStrykerConfig(mutatePatterns);
  const strykerRun = await runStryker(strykerConfig);
  const mutationReport = readMutationReport();
  const allMutants = flattenMutants(mutationReport);

  writeFileSync(reportPath, buildReport(args, changedFiles, mutatePatterns, allMutants, strykerRun));
  writeFileSync(promptPath, buildFixPrompt(args, changedFiles, allMutants, strykerRun));

  console.log(`Tautest prototype completed with ${strykerRun.mode}.`);
  console.log(`Report: ${toPosix(path.relative(repoRoot, reportPath))}`);
  console.log(`Fix prompt: ${toPosix(path.relative(repoRoot, promptPath))}`);
  console.log(`Mutation JSON: ${toPosix(path.relative(repoRoot, mutationJsonPath))}`);
}

function parseArgs(argv: string[]): Args {
  let baseRef = process.env.TAUTEST_BASE ?? 'HEAD';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--base' && argv[i + 1]) {
      baseRef = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--base=')) {
      baseRef = arg.slice('--base='.length);
      continue;
    }

    if (!arg.startsWith('-')) {
      baseRef = arg;
    }
  }

  return { baseRef };
}

function gitDiff(baseRef: string): string {
  return execFileSync('git', ['diff', '--unified=0', '--no-color', baseRef, '--', sourceRoot], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
}

function parseChangedFiles(diff: string): ChangedFile[] {
  const files = new Map<string, ChangedFile>();
  let currentFile: ChangedFile | undefined;
  let currentNewLine = 0;
  let inHunk = false;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      currentFile = undefined;
      inHunk = false;
      continue;
    }

    if (line.startsWith('+++ ')) {
      const filePath = normalizeDiffPath(line.slice(4).trim());
      currentFile = filePath && isSourceFile(filePath) ? ensureChangedFile(files, filePath) : undefined;
      inHunk = false;
      continue;
    }

    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      inHunk = Boolean(currentFile && match);
      currentNewLine = match ? Number(match[1]) : 0;
      continue;
    }

    if (!currentFile || !inHunk || line.length === 0) {
      continue;
    }

    if (line.startsWith('+')) {
      currentFile.lines.add(currentNewLine);
      currentNewLine += 1;
      continue;
    }

    if (line.startsWith('-')) {
      continue;
    }

    if (line.startsWith(' ')) {
      currentNewLine += 1;
    }
  }

  return [...files.values()]
    .map((file) => ({ ...file, ranges: compactLines(file.lines) }))
    .filter((file) => file.ranges.length > 0);
}

function normalizeDiffPath(rawPath: string): string | undefined {
  if (rawPath === '/dev/null') {
    return undefined;
  }

  return toPosix(rawPath.replace(/^"|"$/g, '').replace(/^b\//, ''));
}

function ensureChangedFile(files: Map<string, ChangedFile>, filePath: string): ChangedFile {
  const existing = files.get(filePath);

  if (existing) {
    return existing;
  }

  const next = { filePath, lines: new Set<number>(), ranges: [] };
  files.set(filePath, next);
  return next;
}

function compactLines(lines: Set<number>): ChangedRange[] {
  const sorted = [...lines].sort((a, b) => a - b);
  const ranges: ChangedRange[] = [];

  for (const line of sorted) {
    const last = ranges.at(-1);

    if (last && line === last.end + 1) {
      last.end = line;
    } else {
      ranges.push({ start: line, end: line });
    }
  }

  return ranges;
}

function isSourceFile(filePath: string): boolean {
  const normalized = toPosix(filePath);
  const ext = path.posix.extname(normalized);
  const baseName = path.posix.basename(normalized);

  return (
    normalized.startsWith(`${sourceRoot}/`) &&
    ['.ts', '.tsx', '.js', '.jsx'].includes(ext) &&
    !baseName.endsWith('.d.ts') &&
    !/\.(test|spec)\.[cm]?[tj]sx?$/.test(baseName)
  );
}

function buildStrykerConfig(mutatePatterns: string[]): PartialStrykerOptions {
  return {
    allowConsoleColors: false,
    cleanTempDir: true,
    concurrency: 2,
    coverageAnalysis: 'perTest',
    disableTypeChecks: true,
    jsonReporter: {
      fileName: toPosix(path.relative(repoRoot, mutationJsonPath))
    },
    mutate: mutatePatterns,
    packageManager: 'npm',
    reporters: ['clear-text', 'json'],
    tempDirName: '.stryker-tmp/prototype',
    testRunner: 'vitest',
    thresholds: {
      break: 0,
      high: 0,
      low: 0
    },
    timeoutMS: 5000,
    dryRunTimeoutMinutes: 2,
    tsconfigFile: 'tsconfig.json',
    vitest: {
      configFile: 'examples/vitest-basic/vitest.config.ts',
      related: false
    }
  };
}

async function runStryker(config: PartialStrykerOptions): Promise<StrykerRun> {
  try {
    const stryker = new Stryker(config);
    await stryker.runMutationTest();
    return { mode: 'programmatic' };
  } catch (error) {
    const fallbackReason = errorToString(error);
    writeFallbackConfig(config);

    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = spawnSync(npx, ['stryker', 'run', toPosix(path.relative(repoRoot, fallbackConfigPath))], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false
    });

    if (result.status !== 0) {
      throw new Error(
        `Stryker programmatic API failed and CLI fallback also failed with exit code ${result.status}.\n` +
          `Programmatic failure: ${fallbackReason}`
      );
    }

    return { mode: 'cli-fallback', fallbackReason };
  }
}

function writeFallbackConfig(config: PartialStrykerOptions): void {
  const serialized = JSON.stringify(config, null, 2);
  writeFileSync(fallbackConfigPath, `export default ${serialized};\n`);
}

function readMutationReport(): MutationReport {
  if (!existsSync(mutationJsonPath)) {
    throw new Error(`Expected Stryker JSON report was not found at ${mutationJsonPath}.`);
  }

  return JSON.parse(readFileSync(mutationJsonPath, 'utf8')) as MutationReport;
}

function flattenMutants(report: MutationReport): FlatMutant[] {
  return Object.entries(report.files).flatMap(([filePath, file]) =>
    file.mutants.map((mutant) => ({
      ...mutant,
      filePath: toPosix(filePath),
      original: extractOriginal(file.source, mutant.location)
    }))
  );
}

function extractOriginal(source: string, location: MutationMutant['location']): string {
  const sourceLines = source.split(/\r?\n/);
  const startLine = location.start.line;
  const endLine = location.end.line;
  const firstLine = sourceLines[startLine - 1] ?? '';

  if (startLine === endLine) {
    const original = firstLine.slice(location.start.column, location.end.column);
    return original.trim() || firstLine.trim();
  }

  const selected = sourceLines.slice(startLine - 1, endLine);
  selected[0] = selected[0]?.slice(location.start.column) ?? '';
  selected[selected.length - 1] = selected.at(-1)?.slice(0, location.end.column) ?? '';
  return selected.join('\n').trim();
}

function buildReport(
  args: Args,
  changedFiles: ChangedFile[],
  mutatePatterns: string[],
  mutants: FlatMutant[],
  strykerRun: StrykerRun
): string {
  const counts = summarize(mutants);
  const surviving = mutants
    .filter((mutant) => mutant.status === 'Survived')
    .sort((a, b) => a.filePath.localeCompare(b.filePath) || a.location.start.line - b.location.start.line)
    .slice(0, 10);

  return [
    '# Tautest Prototype Mutation Report',
    '',
    '## Run',
    '',
    `- Base ref: \`${args.baseRef}\``,
    `- Runner: \`vitest\``,
    `- Stryker execution: \`${strykerRun.mode}\``,
    ...(strykerRun.fallbackReason ? [`- Programmatic fallback reason: \`${inline(strykerRun.fallbackReason)}\``] : []),
    '',
    '## Changed Source Scope',
    '',
    ...changedFiles.map((file) => `- \`${file.filePath}\`: ${file.ranges.map(formatRange).join(', ')}`),
    '',
    '## Stryker Mutate Patterns',
    '',
    ...mutatePatterns.map((pattern) => `- \`${pattern}\``),
    '',
    '## Summary',
    '',
    `- Mutation score: **${counts.score.toFixed(2)}%**`,
    `- Killed: **${counts.killed}**`,
    `- Survived: **${counts.survived}**`,
    `- No coverage: **${counts.noCoverage}**`,
    `- Timeout: **${counts.timeout}**`,
    `- Runtime error: **${counts.runtimeError}**`,
    `- Compile error: **${counts.compileError}**`,
    '',
    '## Top Surviving Mutants',
    '',
    surviving.length > 0
      ? '| File | Line | Mutator | Original | Replacement |\n| --- | ---: | --- | --- | --- |\n' +
          surviving
            .map(
              (mutant) =>
                `| \`${mutant.filePath}\` | ${mutant.location.start.line} | ${cell(mutant.mutatorName)} | ${cell(
                  mutant.original
                )} | ${cell(mutant.replacement)} |`
            )
            .join('\n')
      : 'No surviving mutants found in the scoped lines.',
    ''
  ].join('\n');
}

function buildFixPrompt(
  args: Args,
  changedFiles: ChangedFile[],
  mutants: FlatMutant[],
  strykerRun: StrykerRun
): string {
  const surviving = mutants
    .filter((mutant) => mutant.status === 'Survived')
    .sort((a, b) => a.filePath.localeCompare(b.filePath) || a.location.start.line - b.location.start.line)
    .slice(0, 10);

  const targetDetails =
    surviving.length > 0
      ? surviving
          .map(
            (mutant, index) => `${index + 1}. ${mutant.filePath}:${mutant.location.start.line}
   - Mutator: ${mutant.mutatorName}
   - Original: ${block(mutant.original)}
   - Replacement: ${block(mutant.replacement)}
   - Source context:
${indent(sourceContext(mutant.filePath, mutant.location.start.line))}`
          )
          .join('\n\n')
      : 'No surviving mutants were found. Do not invent tests unless you identify a real assertion gap.';

  return `# AI Agent Test-Fix Prompt

You are working on the Tautest Phase 1 Vitest demo.

## Task

Strengthen the test suite so the surviving mutation(s) below are killed.

## Hard Rules

- Do not change production code.
- Only edit test files, preferably \`examples/vitest-basic/src/discount.test.ts\`.
- Every new or changed test must pass against the original production code.
- Every new or changed test must fail against the listed mutant behavior.
- Do not add filler tests that only execute code without strong assertions.
- Do not weaken or remove existing assertions.
- Do not rewrite implementation logic to satisfy the mutation report.
- Prefer a focused boundary test over broad snapshot-like assertions.

## Changed Source Scope

${changedFiles.map((file) => `- \`${file.filePath}\`: ${file.ranges.map(formatRange).join(', ')}`).join('\n')}

## Surviving Mutants To Kill

${targetDetails}

## Suggested Direction

For boundary-condition mutants, add tests at the exact boundary. In this demo, the senior-discount boundary should be asserted directly so changing \`>=\` to \`>\` is observable.

## Commands To Run

\`\`\`bash
npm run test:example
npm run prototype -- --base ${args.baseRef}
\`\`\`

## Current Stryker Execution

- Mode: \`${strykerRun.mode}\`
${strykerRun.fallbackReason ? `- Fallback reason: \`${inline(strykerRun.fallbackReason)}\`\n` : ''}`;
}

function sourceContext(filePath: string, line: number): string {
  const absolutePath = path.join(repoRoot, filePath);
  const lines = readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  const start = Math.max(1, line - 2);
  const end = Math.min(lines.length, line + 2);

  return Array.from({ length: end - start + 1 }, (_, index) => {
    const lineNumber = start + index;
    const marker = lineNumber === line ? '>' : ' ';
    return `${marker} ${String(lineNumber).padStart(3, ' ')} | ${lines[lineNumber - 1]}`;
  }).join('\n');
}

function summarize(mutants: FlatMutant[]): {
  killed: number;
  survived: number;
  noCoverage: number;
  timeout: number;
  runtimeError: number;
  compileError: number;
  score: number;
} {
  const killed = count(mutants, 'Killed');
  const survived = count(mutants, 'Survived');
  const noCoverage = count(mutants, 'NoCoverage');
  const timeout = count(mutants, 'Timeout');
  const runtimeError = count(mutants, 'RuntimeError');
  const compileError = count(mutants, 'CompileError');
  const valid = killed + survived + noCoverage + timeout + runtimeError + compileError;
  const detected = killed + timeout;

  return {
    killed,
    survived,
    noCoverage,
    timeout,
    runtimeError,
    compileError,
    score: valid === 0 ? 100 : (detected / valid) * 100
  };
}

function count(mutants: FlatMutant[], status: string): number {
  return mutants.filter((mutant) => mutant.status === status).length;
}

function formatRange(range: ChangedRange): string {
  return range.start === range.end ? `L${range.start}` : `L${range.start}-L${range.end}`;
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function inline(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/`/g, "'");
}

function cell(value: string): string {
  return inline(value).replace(/\|/g, '\\|');
}

function block(value: string): string {
  return value.includes('\n') ? `\n\`\`\`ts\n${value}\n\`\`\`` : `\`${value}\``;
}

function indent(value: string): string {
  return value
    .split('\n')
    .map((line) => `   ${line}`)
    .join('\n');
}

function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

main().catch((error) => {
  console.error(errorToString(error));
  process.exitCode = 1;
});
