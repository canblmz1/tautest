import type { TestRunner } from '@tautest/core';

export function buildPromptCommands(baseRef: string | undefined, runner: TestRunner): string[] {
  const runCommand = baseRef ? `tautest run --base ${baseRef}` : 'tautest run';
  const testCommand = runner === 'vitest' ? 'vitest run' : 'jest';

  return [runCommand, testCommand];
}
