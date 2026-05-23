import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';

export interface CacheContext {
  workingDirectory: string;
  base: string;
  headRef: string;
  packageManager: string;
  runnerOs?: string;
}

export interface TautestCache {
  cacheKey: string;
  cachePath: string;
  matchedKey?: string;
}

export interface TautestCacheSaveResult {
  status: 'saved' | 'skipped-no-state' | 'skipped-missing-file' | 'already-exists' | 'failed';
  message: string;
}

export function buildCacheKey(context: CacheContext): string {
  const runnerOs = sanitize(context.runnerOs || process.env.RUNNER_OS || process.platform);
  const base = sanitize(context.base);
  const head = sanitize(context.headRef || 'detached');
  const workingDirectoryHash = crypto.createHash('sha256').update(path.resolve(context.workingDirectory)).digest('hex').slice(0, 12);

  return `tautest-${runnerOs}-${context.packageManager}-${base}-${head}-${workingDirectoryHash}`;
}

export async function restoreTautestCache(context: CacheContext): Promise<TautestCache | null> {
  const cachePath = path.join(context.workingDirectory, '.tautest', 'stryker-incremental.json');
  const cacheKey = buildCacheKey(context);
  const restoreKeys = [`tautest-${sanitize(context.runnerOs || process.env.RUNNER_OS || process.platform)}-${context.packageManager}-${sanitize(context.base)}-`];

  try {
    const matchedKey = await cache.restoreCache([cachePath], cacheKey, restoreKeys);
    return {
      cacheKey,
      cachePath,
      matchedKey: matchedKey || undefined
    };
  } catch (error) {
    core.warning(`Could not restore Tautest cache: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function saveTautestCache(state: TautestCache | null): Promise<TautestCacheSaveResult> {
  if (!state) {
    return {
      status: 'skipped-no-state',
      message: 'Cache restore did not produce a cache state.'
    };
  }

  if (!existsSync(state.cachePath)) {
    const message = 'No Tautest incremental cache file found to save.';
    core.info(message);
    return {
      status: 'skipped-missing-file',
      message
    };
  }

  try {
    await cache.saveCache([state.cachePath], state.cacheKey);
    return {
      status: 'saved',
      message: 'Saved Tautest incremental cache.'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/already exists|reserve/i.test(message)) {
      const alreadyExistsMessage = 'Tautest cache already exists for this key.';
      core.info(alreadyExistsMessage);
      return {
        status: 'already-exists',
        message: alreadyExistsMessage
      };
    }

    core.warning(`Could not save Tautest cache: ${message}`);
    return {
      status: 'failed',
      message
    };
  }
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 80) || 'unknown';
}
