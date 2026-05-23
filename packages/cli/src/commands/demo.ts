import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export interface DemoOptions {
  json?: boolean;
  run?: boolean;
}

export interface DemoExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type DemoExecutor = (command: string, args: string[], cwd: string) => DemoExecResult;

interface DemoStep {
  title: string;
  command?: string;
  detail: string;
}

interface DemoRunStep {
  title: string;
  command: string;
  exitCode: number;
  ok: boolean;
  stdoutTail: string;
  stderrTail: string;
}

interface DemoRunResult {
  repoRoot: string;
  example: string;
  restored: boolean;
  steps: DemoRunStep[];
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

export async function runDemoCommand(cwd: string, options: DemoOptions = {}, executor: DemoExecutor = defaultExecutor): Promise<string> {
  if (options.run) {
    const result = runDemoWorkflow(cwd, executor);
    return options.json ? `${JSON.stringify(result, null, 2)}\n` : formatDemoRunResult(result);
  }

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
    '',
    '  $ tautest demo --run',
    '',
    'Or run the steps yourself:',
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

function runDemoWorkflow(cwd: string, executor: DemoExecutor): DemoRunResult {
  const repoRoot = findDemoRepoRoot(cwd);
  const exampleRoot = path.join(repoRoot, 'examples', 'vitest-basic');
  const sourcePath = path.join(exampleRoot, 'src', 'discount.ts');
  const testPath = path.join(exampleRoot, 'src', 'discount.test.ts');
  const originalSource = readFileSync(sourcePath, 'utf8');
  const originalTest = readFileSync(testPath, 'utf8');
  const steps: DemoRunStep[] = [];
  let restored = false;

  ensureDemoFixtureClean(repoRoot, executor);

  try {
    writeFileSync(sourcePath, addSourceDemoDiff(originalSource));

    steps.push(runStep('Weak tests still pass', 'pnpm', ['--dir', 'examples/vitest-basic', 'test'], repoRoot, [0], executor));
    steps.push(
      runStep(
        'Tautest finds the surviving mutant',
        'pnpm',
        ['--dir', 'examples/vitest-basic', 'exec', 'tautest', 'run', '--base', 'HEAD', '--threshold', '80', '--prompt-style', 'codex'],
        repoRoot,
        [0, 1],
        executor
      )
    );

    writeFileSync(testPath, addBoundaryTest(originalTest));

    steps.push(runStep('Fixed tests pass', 'pnpm', ['--dir', 'examples/vitest-basic', 'test'], repoRoot, [0], executor));
    steps.push(
      runStep(
        'Tautest passes after the boundary test',
        'pnpm',
        ['--dir', 'examples/vitest-basic', 'exec', 'tautest', 'run', '--base', 'HEAD', '--threshold', '80', '--prompt-style', 'codex'],
        repoRoot,
        [0],
        executor
      )
    );
  } finally {
    writeFileSync(sourcePath, originalSource);
    writeFileSync(testPath, originalTest);
    restored = true;
  }

  return {
    repoRoot,
    example: 'examples/vitest-basic',
    restored,
    steps
  };
}

function runStep(title: string, command: string, args: string[], cwd: string, allowedExitCodes: number[], executor: DemoExecutor): DemoRunStep {
  const result = executor(command, args, cwd);
  const ok = allowedExitCodes.includes(result.exitCode);
  const step: DemoRunStep = {
    title,
    command: formatCommand(command, args),
    exitCode: result.exitCode,
    ok,
    stdoutTail: lastLines(stripAnsi(result.stdout), 8),
    stderrTail: lastLines(stripAnsi(result.stderr), 8)
  };

  if (!ok) {
    throw new Error(`Demo step failed: ${step.title}\n${step.command}\nexit code ${step.exitCode}\n${step.stdoutTail}\n${step.stderrTail}`);
  }

  return step;
}

function ensureDemoFixtureClean(repoRoot: string, executor: DemoExecutor): void {
  const result = executor('git', ['status', '--porcelain', '--', 'examples/vitest-basic/src/discount.ts', 'examples/vitest-basic/src/discount.test.ts'], repoRoot);

  if (result.exitCode !== 0) {
    throw new Error(`Could not inspect demo fixture git status.\n${result.stderr || result.stdout}`);
  }

  if (result.stdout.trim().length > 0) {
    throw new Error('Demo fixture files are already modified. Restore examples/vitest-basic/src/discount.ts and discount.test.ts before running `tautest demo --run`.');
  }
}

function findDemoRepoRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    const sourcePath = path.join(current, 'examples', 'vitest-basic', 'src', 'discount.ts');
    const testPath = path.join(current, 'examples', 'vitest-basic', 'src', 'discount.test.ts');

    if (existsSync(sourcePath) && existsSync(testPath)) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      throw new Error('Could not find examples/vitest-basic. `tautest demo --run` currently runs from a Tautest repository checkout.');
    }

    current = parent;
  }
}

function addSourceDemoDiff(source: string): string {
  const target = 'if (age >= 65) {';

  if (!source.includes(target)) {
    throw new Error('Demo source fixture no longer contains the expected senior boundary.');
  }

  return source.replace(target, 'if (age >= 65) { // demo boundary');
}

function addBoundaryTest(testSource: string): string {
  if (testSource.includes("applies the senior discount at the exact boundary")) {
    return testSource;
  }

  const marker = /\r?\n\r?\n  it\('applies the subtotal discount at 100'/;
  const boundaryTest = `

  it('applies the senior discount at the exact boundary', () => {
    expect(calculateDiscount(65, 100)).toBe(20);
  });`;

  if (!marker.test(testSource)) {
    throw new Error('Demo test fixture no longer contains the expected insertion point.');
  }

  return testSource.replace(marker, (match) => `${boundaryTest}${match}`);
}

function formatDemoRunResult(result: DemoRunResult): string {
  return [
    'Tautest demo run completed',
    '',
    `Example: ${result.example}`,
    `Working tree restored: ${result.restored ? 'yes' : 'no'}`,
    '',
    ...result.steps.flatMap((step, index) => [
      `${index + 1}. ${step.ok ? 'OK' : 'FAIL'} ${step.title}`,
      `   $ ${step.command}`,
      `   exit code: ${step.exitCode}`,
      ...(step.stdoutTail !== '(empty)' ? [`   stdout: ${indentTail(step.stdoutTail)}`] : []),
      ...(step.stderrTail !== '(empty)' ? [`   stderr: ${indentTail(step.stderrTail)}`] : []),
      ''
    ]),
    'Signal: weak tests pass first, Tautest reports the surviving boundary mutant, then the boundary test kills it.'
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

function defaultExecutor(command: string, args: string[], cwd: string): DemoExecResult {
  const executable = process.platform === 'win32' ? 'cmd.exe' : command;
  const executableArgs = process.platform === 'win32' ? ['/d', '/s', '/c', formatCommand(command, args)] : args;
  const result = spawnSync(executable, executableArgs, {
    cwd,
    encoding: 'utf8',
    shell: false
  });

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || ''
  };
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteArg).join(' ');
}

function quoteArg(value: string): string {
  if (!/[\s"']/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function lastLines(value: string, maxLines: number): string {
  const trimmed = value.trimEnd();

  if (!trimmed) {
    return '(empty)';
  }

  return trimmed.split(/\r?\n/).slice(-maxLines).join('\n');
}

function indentTail(value: string): string {
  return value.replace(/\r?\n/g, '\n           ');
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}
