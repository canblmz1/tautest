export interface DemoOptions {
  json?: boolean;
}

interface DemoStep {
  title: string;
  command?: string;
  detail: string;
}

const demoSteps: DemoStep[] = [
  {
    title: 'Run the weak test suite',
    command: 'pnpm --dir examples/vitest-basic test',
    detail: 'The example tests pass, but they only check age 70 and miss the exact senior boundary.'
  },
  {
    title: 'Create a tiny production diff',
    command:
      'node -e "const fs=require(\'node:fs\'); const p=\'examples/vitest-basic/src/discount.ts\'; const s=fs.readFileSync(p,\'utf8\'); fs.writeFileSync(p,s.replace(\'if (age >= 65) {\',\'if (age >= 65) { // demo boundary\'))"',
    detail: 'Tautest works from git diff, so this creates a behavior-preserving change on the boundary line.'
  },
  {
    title: 'Run changed-line mutation testing',
    command: 'pnpm --dir examples/vitest-basic exec tautest run --base HEAD --threshold 80 --prompt-style codex || true',
    detail: 'The demo is expected to fail the threshold because Tautest finds the surviving boundary mutant.'
  },
  {
    title: 'Use the generated fix prompt',
    command: 'pnpm --dir examples/vitest-basic exec tautest prompt --style codex',
    detail: 'The prompt asks a human or coding agent to add a test-only fix for the surviving mutant.'
  }
];

export function runDemoCommand(options: DemoOptions = {}): string {
  if (options.json) {
    return `${JSON.stringify(buildDemoJson(), null, 2)}\n`;
  }

  return [
    'Tautest demo: tests can pass while a changed-line mutant survives',
    '',
    'This repository includes a small Vitest fixture at examples/vitest-basic.',
    'It intentionally misses the exact senior discount boundary:',
    '',
    '  Original:    age >= 65',
    '  Mutant:      age > 65',
    '  Missing test: expect(calculateDiscount(65, 100)).toBe(20)',
    '',
    'Try it locally:',
    ...demoSteps.flatMap((step, index) => [
      '',
      `${index + 1}. ${step.title}`,
      `   ${step.detail}`,
      ...(step.command ? [`   $ ${step.command}`] : [])
    ]),
    '',
    'Expected signal:',
    '  Tautest reports a surviving EqualityOperator mutant in src/discount.ts.',
    '  After adding the fixed boundary test, the mutation score reaches 100%.',
    '',
    'Clean up and the full before/after flow are documented in docs/DEMO.md.',
    '',
    'Docs: docs/DEMO.md'
  ].join('\n');
}

function buildDemoJson(): unknown {
  return {
    example: 'examples/vitest-basic',
    point: 'tests can pass while a changed-line mutant survives',
    mutant: {
      file: 'src/discount.ts',
      mutatorName: 'EqualityOperator',
      original: 'age >= 65',
      replacement: 'age > 65',
      missingTest: 'expect(calculateDiscount(65, 100)).toBe(20)'
    },
    steps: demoSteps
  };
}
