import type { PromptStyle, ReportMutant, SurvivingMutant } from '../types';
import { selectTopMutants } from '../score/score';
import { PROMPT_HARD_RULES, PROMPT_VALIDATION_LOOP } from '../report/json';
import { enrichMutant } from '../report/insights';

export function buildFixPrompt(input: {
  mutants: SurvivingMutant[];
  testRunner: 'vitest' | 'jest';
  commands?: string[];
  maxMutants?: number;
  style?: PromptStyle;
}): string {
  const topMutants = selectTopMutants(input.mutants, input.maxMutants ?? 10);
  const enrichedMutants = topMutants.map(enrichMutant);
  const commands = input.commands ?? ['pnpm test'];
  const style = input.style ?? 'agent';

  return `# Tautest Test-Fix Prompt

${styleIntro(style)}

## Objective

Strengthen the test suite so the listed surviving or uncovered mutants are killed. Make the smallest test-only change that proves the intended behavior.

## Hard Rules

${PROMPT_HARD_RULES.map((rule) => `- ${rule}`).join('\n')}
- Keep the fix small and aligned with the existing ${input.testRunner} test style.
- Prefer focused boundary, branch, and behavior assertions over snapshots or broad smoke tests.

## Mutants To Kill

${enrichedMutants.length > 0 ? enrichedMutants.map(formatMutant).join('\n\n') : 'No surviving mutants were provided.'}

## Validation Loop

1. Add or strengthen the smallest test that observes the behavioral difference.
${PROMPT_VALIDATION_LOOP.map((step, index) => `${index + 2}. ${step}`).join('\n')}

## Commands

\`\`\`bash
${commands.join('\n')}
\`\`\`
`;
}

function formatMutant(mutant: ReportMutant, index: number): string {
  return `${index + 1}. \`${mutant.filePath}:${mutant.line}\`
   - Status: ${mutant.status}
   - Mutator: ${mutant.mutatorName}
   - Original: ${inlineCode(mutant.original)}
   - Replacement: ${inlineCode(mutant.replacement)}
   - Covering tests: ${formatCoveringTests(mutant)}
   - Why this matters: ${mutant.insight.whyThisMatters}
   - Suggested test idea: ${mutant.insight.suggestedTestIdea}`;
}

function inlineCode(value: string): string {
  return value.includes('\n') ? `\n\`\`\`ts\n${value}\n\`\`\`` : `\`${value.replace(/`/g, "'")}\``;
}

function formatCoveringTests(mutant: ReportMutant): string {
  if (mutant.coveringTests.length === 0) {
    return 'none reported by Stryker';
  }

  return mutant.coveringTests.map((test) => `${test.filePath} - ${test.name}`).join('; ');
}

function styleIntro(style: PromptStyle): string {
  if (style === 'human') {
    return 'Use this as a human test-writing checklist. Improve only the tests that prove the behavior described by the mutants.';
  }

  if (style === 'claude-code') {
    return 'You are Claude Code working in an existing repository. Inspect the relevant tests first, then make a focused test-only patch.';
  }

  if (style === 'cursor') {
    return 'You are Cursor editing an existing project. Keep the patch local to test files and use the current test style.';
  }

  if (style === 'codex') {
    return 'You are Codex working in the current workspace. Modify tests only, run verification, and report any suspected production bug instead of changing implementation.';
  }

  return 'You are an AI coding agent improving tests based on Tautest mutation results.';
}
