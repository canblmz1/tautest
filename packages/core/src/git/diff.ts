import { execFileSync } from 'node:child_process';
import type { ChangedFile, ChangedFileStatus, DiffParseOptions, GitDiffOptions } from '../types';

const DEFAULT_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
const DEFAULT_TEST_PATTERN = /(^|[/\\])(__tests__|test|tests)([/\\]|$)|\.(test|spec)\.[cm]?[tj]sx?$/;
const GIT_DIFF_MAX_BUFFER = 50 * 1024 * 1024;

interface MutableChangedFile extends ChangedFile {
  lineSet: Set<number>;
}

export function readGitDiff(options: GitDiffOptions): string {
  const args = ['diff', '--unified=0', '--no-color', options.baseRef];

  if (options.relative) {
    args.splice(1, 0, '--relative');
  }

  if (options.paths && options.paths.length > 0) {
    args.push('--', ...options.paths);
  }

  return execFileSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: GIT_DIFF_MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

export function getChangedFiles(options: GitDiffOptions): ChangedFile[] {
  return parseGitDiff(readGitDiff(options), options);
}

export function parseGitDiff(diff: string, options: DiffParseOptions = {}): ChangedFile[] {
  const files: MutableChangedFile[] = [];
  let current: MutableChangedFile | undefined;
  let currentNewLine = 0;
  let inHunk = false;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      current = createDiffFile(line, options);
      files.push(current);
      inHunk = false;
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith('new file mode ')) {
      current.status = 'added';
      continue;
    }

    if (line.startsWith('deleted file mode ')) {
      current.status = 'deleted';
      current.warnings.push('File is deleted; no current source lines can be mutated.');
      continue;
    }

    if (line.startsWith('similarity index ') || line.startsWith('rename from ') || line.startsWith('rename to ')) {
      current.status = current.status === 'deleted' ? 'deleted' : 'renamed';
      if (line.startsWith('rename from ')) {
        current.oldPath = normalizeGitPath(line.slice('rename from '.length));
      }
      if (line.startsWith('rename to ')) {
        current.path = normalizeGitPath(line.slice('rename to '.length));
        current.isTest = isTestFile(current.path, options.testFilePattern);
        current.isSource = isSourceFile(current.path, options);
      }
      continue;
    }

    if (line.startsWith('Binary files ')) {
      current.status = 'binary';
      current.isBinary = true;
      current.warnings.push('Binary file diff skipped.');
      continue;
    }

    if (line.startsWith('+++ ')) {
      const nextPath = normalizePatchPath(line.slice(4));

      if (nextPath) {
        current.path = nextPath;
        current.isTest = isTestFile(current.path, options.testFilePattern);
        current.isSource = isSourceFile(current.path, options);
      }
      continue;
    }

    if (line.startsWith('--- ')) {
      const oldPath = normalizePatchPath(line.slice(4));

      if (oldPath) {
        current.oldPath = oldPath;
      }
      continue;
    }

    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)(?:,(\d+))?/);
      inHunk = Boolean(match);
      currentNewLine = match ? Number(match[1]) : 0;
      continue;
    }

    if (!inHunk || current.status === 'deleted' || current.status === 'binary') {
      continue;
    }

    if (line.startsWith('+')) {
      current.lineSet.add(currentNewLine);
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

  return files.map(({ lineSet, ...file }) => ({
    ...file,
    ranges: compactLines(lineSet)
  }));
}

export function getChangedSourceFiles(files: ChangedFile[]): ChangedFile[] {
  return files.filter((file) => file.isSource && !file.isTest && !file.isBinary && file.status !== 'deleted');
}

function createDiffFile(line: string, options: DiffParseOptions): MutableChangedFile {
  const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
  const filePath = normalizeGitPath(match?.[2] ?? '');
  const oldPath = normalizeGitPath(match?.[1] ?? filePath);

  return {
    path: filePath,
    oldPath,
    status: 'modified',
    ranges: [],
    lineSet: new Set<number>(),
    isSource: isSourceFile(filePath, options),
    isTest: isTestFile(filePath, options.testFilePattern),
    isBinary: false,
    warnings: []
  };
}

function compactLines(lines: Set<number>) {
  const sorted = [...lines].sort((a, b) => a - b);
  const ranges: Array<{ start: number; end: number }> = [];

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

function isSourceFile(filePath: string, options: DiffParseOptions): boolean {
  const extensions = options.sourceFileExtensions ?? DEFAULT_SOURCE_EXTENSIONS;
  const normalized = toPosix(filePath);
  const ext = normalized.slice(normalized.lastIndexOf('.'));

  return (
    extensions.includes(ext) &&
    !isTestFile(normalized, options.testFilePattern) &&
    !normalized.endsWith('.d.ts') &&
    !/\.config\.[cm]?[jt]s$/.test(normalized)
  );
}

function isTestFile(filePath: string, pattern = DEFAULT_TEST_PATTERN): boolean {
  return pattern.test(toPosix(filePath));
}

function normalizePatchPath(rawPath: string): string | undefined {
  const trimmed = rawPath.trim();

  if (trimmed === '/dev/null') {
    return undefined;
  }

  return normalizeGitPath(trimmed.replace(/^[ab]\//, ''));
}

function normalizeGitPath(rawPath: string): string {
  return toPosix(rawPath.trim().replace(/^"|"$/g, ''));
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}
