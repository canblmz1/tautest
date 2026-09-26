import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'tinyglobby';
import { loadConfigFile } from '../config/load';
import type { ChangedFile } from '../types';

const STRYKER_CONFIG_FILES = [
  'stryker.config.json',
  'stryker.config.mjs',
  'stryker.config.js',
  'stryker.config.cjs',
  'stryker.conf.json',
  'stryker.conf.mjs',
  'stryker.conf.js',
  'stryker.conf.cjs'
];

export async function readStrykerMutateScope(rootDir: string): Promise<string[] | undefined> {
  const configPath = STRYKER_CONFIG_FILES.map((name) => path.join(rootDir, name)).find((candidate) => existsSync(candidate));

  if (!configPath) {
    return undefined;
  }

  const config = configPath.endsWith('.json') ? JSON.parse(readFileSync(configPath, 'utf8')) : await loadConfigFile(configPath);
  const mutate = (config as { mutate?: unknown } | null)?.mutate;

  return Array.isArray(mutate) && mutate.length > 0 && mutate.every((entry) => typeof entry === 'string') ? mutate : undefined;
}

// A changed file the project's own Stryker config would never mutate (build scripts,
// generated code) is not production code for this run, whatever its extension.
export function markOutsideMutateScope(files: ChangedFile[], mutate: string[] | undefined, rootDir: string): ChangedFile[] {
  if (!mutate) {
    return files;
  }

  const inScope = new Set(globSync(mutate.map(withoutLineRange), { cwd: rootDir, ignore: ['**/node_modules/**'] }));

  return files.map((file) => (file.isSource && !inScope.has(file.path) ? { ...file, isSource: false, outsideMutateScope: true } : file));
}

function withoutLineRange(pattern: string): string {
  return pattern.replace(/:\d+(?::\d+)?-\d+(?::\d+)?$/, '');
}
