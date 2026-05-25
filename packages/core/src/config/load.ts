import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { DEFAULT_TAUTEST_CONFIG } from './defaults';
import { tautestConfigSchema } from './schema';
import type { TautestConfig, UserTautestConfig } from '../types';

const CONFIG_FILES = ['tautest.config.ts', 'tautest.config.mjs', 'tautest.config.js', 'tautest.config.cjs', 'tautest.config.json'];

export function defineConfig(config: UserTautestConfig): UserTautestConfig {
  return config;
}

export async function loadTautestConfig(rootDir: string): Promise<TautestConfig> {
  const configPath = findTautestConfig(rootDir);

  if (!configPath) {
    return DEFAULT_TAUTEST_CONFIG;
  }

  return loadTautestConfigFromFile(configPath);
}

export async function loadTautestConfigFromFile(configPath: string, options: { alias?: Record<string, string> } = {}): Promise<TautestConfig> {
  const loaded = await loadConfigFile(configPath, options);
  return resolveTautestConfig(loaded);
}

export function findTautestConfig(rootDir: string): string | null {
  for (const fileName of CONFIG_FILES) {
    const candidate = path.join(rootDir, fileName);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function loadConfigFile(configPath: string, options: { alias?: Record<string, string> } = {}): Promise<unknown> {
  if (configPath.endsWith('.json')) {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  }

  const jiti = createJiti(configPath, {
    alias: options.alias,
    moduleCache: false,
    interopDefault: true
  });
  const loaded = await jiti.import(configPath, { default: true });
  return loaded;
}

export function resolveTautestConfig(input: unknown): TautestConfig {
  const parsed = tautestConfigSchema.parse(input ?? {});

  return {
    ...DEFAULT_TAUTEST_CONFIG,
    ...parsed,
    score: {
      ...DEFAULT_TAUTEST_CONFIG.score,
      ...parsed.score
    },
    stryker: {
      ...DEFAULT_TAUTEST_CONFIG.stryker,
      ...parsed.stryker
    },
    prompt: {
      ...DEFAULT_TAUTEST_CONFIG.prompt,
      ...parsed.prompt
    },
    llm: {
      ...DEFAULT_TAUTEST_CONFIG.llm,
      ...parsed.llm
    }
  };
}
