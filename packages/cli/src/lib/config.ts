import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTautestConfig, loadTautestConfigFromFile, type TautestConfig } from '@tautest/core';

export async function loadCliConfig(rootDir: string, configPath?: string): Promise<TautestConfig> {
  const alias = {
    '@tautest/core': fileURLToPath(import.meta.resolve('@tautest/core'))
  };

  if (configPath) {
    return loadTautestConfigFromFile(path.resolve(rootDir, configPath), { alias });
  }

  const discovered = await loadTautestConfigWithAlias(rootDir, alias);
  return discovered;
}

async function loadTautestConfigWithAlias(rootDir: string, alias: Record<string, string>): Promise<TautestConfig> {
  const { findTautestConfig } = await import('@tautest/core');
  const configPath = findTautestConfig(rootDir);

  if (configPath) {
    return loadTautestConfigFromFile(configPath, { alias });
  }

  return loadTautestConfig(rootDir);
}
