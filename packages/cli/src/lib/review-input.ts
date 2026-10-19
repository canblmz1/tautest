import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { validateStrykerReviewReport, reviewHash } from '@tautest/core';
import { CliError } from './errors';
import { EXIT_CODES } from './exit-codes';
import { readLargeReviewReport, REVIEW_DATA_LIMIT, REVIEW_INPUT_LIMIT } from './large-review-input';

export async function readReviewInput(cwd: string, from: string) {
  const file = path.resolve(cwd, from);
  try {
    const size = statSync(file).size;
    if (size > REVIEW_INPUT_LIMIT) throw new Error('Report exceeds the 1 GiB import limit.');
    if (size > REVIEW_DATA_LIMIT) {
      const { value, hash, importDetails } = await readLargeReviewReport(file);
      return { path: file, hash, report: validateStrykerReviewReport(value), importDetails };
    }
    const text = readFileSync(file, 'utf8');
    return { path: file, hash: reviewHash(text), report: validateStrykerReviewReport(JSON.parse(text)), importDetails: undefined };
  } catch (error) {
    // Keep engine-integrity errors distinct from malformed input.
    if (error instanceof Error && 'code' in error && error.code === 'STRYKER_ZERO_TESTS_EXECUTED') throw error;
    throw new CliError(`Cannot import Stryker report: ${error instanceof Error ? error.message : String(error)}`, EXIT_CODES.configError);
  }
}

export function projectFile(root: string, file: string): string {
  if (path.isAbsolute(file) || /^[a-z]:/i.test(file) || file.includes('\\') || file.split('/').includes('..')) {
    throw new CliError(`Report path must be relative to the project: ${file}`, EXIT_CODES.configError);
  }
  const target = path.resolve(root, file);
  if (existsSync(target)) {
    const relative = path.relative(realpathSync(root), realpathSync(target));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new CliError(`File resolves outside the project: ${file}`, EXIT_CODES.configError);
    }
  }
  return target;
}

export function assertFreshSource(root: string, file: string, source: string): void {
  const target = projectFile(root, file);
  if (!existsSync(target) || readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== source.replace(/\r\n/g, '\n')) {
    throw new CliError(`Source changed or is unavailable: ${file}. Generate a fresh Stryker report before verification.`, EXIT_CODES.configError);
  }
}
