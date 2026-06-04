import type { TimeTravelHelperOptions } from './types';

export function buildTimeTravelHelper(options: TimeTravelHelperOptions): string {
  return options.runner === 'jest' ? buildJestHelper() : buildVitestHelper();
}

function buildVitestHelper(): string {
  return `import { afterEach, vi } from 'vitest';

export function freezeTime(isoDate: string | Date): Date {
  const frozen = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  vi.useFakeTimers();
  vi.setSystemTime(frozen);
  return frozen;
}

export async function advanceTime(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

export async function runPendingAsync(): Promise<void> {
  await vi.runOnlyPendingTimersAsync();
}

export function restoreTime(): void {
  vi.useRealTimers();
}

afterEach(() => {
  restoreTime();
});
`;
}

function buildJestHelper(): string {
  return `import { afterEach, jest } from '@jest/globals';

export function freezeTime(isoDate: string | Date): Date {
  const frozen = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  jest.useFakeTimers();
  jest.setSystemTime(frozen);
  return frozen;
}

export async function advanceTime(ms: number): Promise<void> {
  await jest.advanceTimersByTimeAsync(ms);
}

export async function runPendingAsync(): Promise<void> {
  await jest.runOnlyPendingTimersAsync();
}

export function restoreTime(): void {
  jest.useRealTimers();
}

afterEach(() => {
  restoreTime();
});
`;
}
