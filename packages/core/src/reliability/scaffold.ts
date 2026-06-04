import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ScaffoldFramework, ScaffoldLanguage, ScaffoldOptions, ScaffoldResult } from './types';

export function buildTestScaffold(options: ScaffoldOptions): ScaffoldResult {
  const sourcePath = path.resolve(options.cwd, options.filePath);
  const relativeSourcePath = relative(options.cwd, sourcePath);
  const source = readFileSync(sourcePath, 'utf8');
  const language = options.language ?? inferLanguage(sourcePath);
  const framework = options.framework ?? defaultFramework(language);
  const detected = analyzeSource(source, language);
  const suggestedTestPath = suggestTestPath(relativeSourcePath, language);
  const code = language === 'python' ? buildPythonScaffold(relativeSourcePath, detected) : buildJsScaffold(relativeSourcePath, suggestedTestPath, framework, detected);
  const warnings = buildWarnings(language, framework, detected);

  return {
    language,
    framework,
    sourcePath: relativeSourcePath,
    suggestedTestPath,
    code,
    detected,
    warnings
  };
}

function buildJsScaffold(
  sourcePath: string,
  testPath: string,
  framework: ScaffoldFramework,
  detected: ScaffoldResult['detected']
): string {
  const importPath = toRelativeImport(sourcePath, testPath);
  const testApi = framework === 'jest' ? "@jest/globals" : framework;
  const importedNames = detected.functions.length > 0 ? detected.functions.join(', ') : 'subject';
  const firstFunction = detected.functions[0] ?? 'subject';
  const asyncKeyword = detected.asyncFunctions.includes(firstFunction) ? 'async ' : '';
  const awaited = detected.asyncFunctions.includes(firstFunction) ? 'await ' : '';
  const mockSection = detected.dependencies.length
    ? `\n// Detected external dependencies: ${detected.dependencies.join(', ')}.\n// Add framework-specific mocks before importing code under test when these dependencies cross process or network boundaries.\n`
    : '';

  return `import { describe, expect, it } from '${testApi}';
import { ${importedNames} } from '${importPath}';
${mockSection}
describe('${path.posix.basename(sourcePath)}', () => {
  it('covers the primary behavior', ${asyncKeyword}() => {
    const result = ${awaited}${firstFunction}();

    expect(result).toBeDefined();
  });
});
`;
}

function buildPythonScaffold(sourcePath: string, detected: ScaffoldResult['detected']): string {
  const modulePath = sourcePath.replace(/\.py$/, '').replace(/[\\/]/g, '.');
  const firstFunction = detected.functions[0] ?? 'subject';
  const isAsync = detected.asyncFunctions.includes(firstFunction);
  const asyncMarker = isAsync ? '@pytest.mark.asyncio\n' : '';
  const testPrefix = isAsync ? 'async ' : '';
  const awaited = isAsync ? 'await ' : '';
  const fixtures = detected.dependencies.length
    ? `
@pytest.fixture
def external_dependencies(monkeypatch):
    # Detected external dependencies: ${detected.dependencies.join(', ')}.
    # Replace network, database, filesystem, and clock calls with deterministic fakes here.
    return monkeypatch
`
    : '';
  const fixtureArg = detected.dependencies.length ? 'external_dependencies' : '';

  return `import pytest

from ${modulePath} import ${firstFunction}
${fixtures}
${asyncMarker}${testPrefix}def test_${firstFunction}_primary_behavior(${fixtureArg}):
    result = ${awaited}${firstFunction}()

    assert result is not None
`;
}

function analyzeSource(source: string, language: ScaffoldLanguage): ScaffoldResult['detected'] {
  if (language === 'python') {
    const functions = [...source.matchAll(/^\s*(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/gm)].map((match) => match[1]).filter(Boolean);
    const asyncFunctions = [...source.matchAll(/^\s*async\s+def\s+([a-zA-Z_]\w*)\s*\(/gm)].map((match) => match[1]).filter(Boolean);

    return {
      functions,
      asyncFunctions,
      dependencies: detectDependencies(source, [
        ['requests', /\bimport\s+requests\b|\bfrom\s+requests\b/],
        ['httpx', /\bimport\s+httpx\b|\bfrom\s+httpx\b/],
        ['aiohttp', /\bimport\s+aiohttp\b|\bfrom\s+aiohttp\b/],
        ['sqlalchemy', /\bimport\s+sqlalchemy\b|\bfrom\s+sqlalchemy\b/],
        ['psycopg', /\bimport\s+psycopg\b|\bfrom\s+psycopg\b/],
        ['sqlite3', /\bimport\s+sqlite3\b|\bfrom\s+sqlite3\b/],
        ['time', /\bimport\s+time\b|\bdatetime\.now\b/]
      ])
    };
  }

  const functions = [
    ...source.matchAll(/\bexport\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(/g),
    ...source.matchAll(/\bexport\s+const\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g)
  ]
    .map((match) => match[1])
    .filter(Boolean);
  const asyncFunctions = [
    ...source.matchAll(/\bexport\s+async\s+function\s+([a-zA-Z_$][\w$]*)\s*\(/g),
    ...source.matchAll(/\bexport\s+const\s+([a-zA-Z_$][\w$]*)\s*=\s*async\b/g)
  ]
    .map((match) => match[1])
    .filter(Boolean);

  return {
    functions,
    asyncFunctions,
    dependencies: detectDependencies(source, [
      ['fetch', /\bfetch\s*\(/],
      ['axios', /\baxios\./],
      ['node:http', /\bfrom\s+['"]node:http['"]|\brequire\(['"]node:http['"]\)/],
      ['node:https', /\bfrom\s+['"]node:https['"]|\brequire\(['"]node:https['"]\)/],
      ['fs', /\bfrom\s+['"]node:fs['"]|\brequire\(['"]fs['"]\)/],
      ['database', /\b(pg|mysql|postgres|sqlite|prisma|sequelize)\b/i]
    ])
  };
}

function detectDependencies(source: string, rules: Array<[string, RegExp]>): string[] {
  return rules.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}

function buildWarnings(language: ScaffoldLanguage, framework: ScaffoldFramework, detected: ScaffoldResult['detected']): string[] {
  const warnings: string[] = [];

  if (language === 'python') {
    warnings.push('Python scaffold is experimental and does not imply full Python mutation support.');
  }

  if (framework === 'pytest' && language !== 'python') {
    warnings.push('pytest is only supported for Python scaffolds.');
  }

  if (detected.functions.length === 0) {
    warnings.push('No exported/top-level function was detected; generated scaffold uses a placeholder subject.');
  }

  return warnings;
}

function inferLanguage(filePath: string): ScaffoldLanguage {
  if (filePath.endsWith('.py')) {
    return 'python';
  }

  if (/\.[cm]?tsx?$/.test(filePath)) {
    return 'typescript';
  }

  return 'javascript';
}

function defaultFramework(language: ScaffoldLanguage): ScaffoldFramework {
  return language === 'python' ? 'pytest' : 'vitest';
}

function suggestTestPath(sourcePath: string, language: ScaffoldLanguage): string {
  if (language === 'python') {
    const parsed = path.posix.parse(sourcePath.replace(/\\/g, '/'));
    return path.posix.join('tests', `test_${parsed.name}.py`);
  }

  return sourcePath.replace(/(\.[cm]?[jt]sx?)$/, '.test$1');
}

function toRelativeImport(sourcePath: string, testPath: string): string {
  const normalizedSource = sourcePath.replace(/(\.[cm]?[jt]sx?)$/, '').replace(/\\/g, '/');
  const normalizedTestDir = path.posix.dirname(testPath.replace(/\\/g, '/'));
  const relativeImport = path.posix.relative(normalizedTestDir, normalizedSource);

  return relativeImport.startsWith('.') ? relativeImport : `./${relativeImport}`;
}

function relative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}
