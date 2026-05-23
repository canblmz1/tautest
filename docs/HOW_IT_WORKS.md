# How It Works

Tautest is a workflow layer around StrykerJS.

## 1. Git Diff

Tautest starts with:

```bash
git diff --unified=0 <base>
```

It only needs changed line numbers, so zero-context diffs are enough.

## 2. Changed Line Ranges

The diff parser extracts changed production source lines and skips test files, deleted files, and binary files.

Example:

```text
src/discount.ts lines 2-2
```

## 3. Stryker Mutate Scope

Changed ranges become Stryker mutate patterns:

```text
src/discount.ts:2-2
```

Tautest does not mutate code itself. It passes this scope to StrykerJS.

## 4. Stryker Run

StrykerJS runs mutation testing with the detected runner:

- Vitest
- Jest

Stryker produces mutation JSON.

## 5. Tautest Reports

Tautest reads Stryker JSON and writes:

- Markdown report for humans.
- Stable JSON report for tools.
- Terminal summary for CI logs.

The markdown report includes verdict, score, threshold, runner, runtime, mutated files, surviving mutants, covering tests, why each mutant matters, and suggested test ideas.

## 6. Fix Prompt

Tautest generates `.tautest/fix-prompt.md`.

The prompt is deterministic. It does not call an LLM. It includes hard rules that tell an agent to edit tests only, avoid filler tests, avoid weakening assertions, and rerun validation.

## 7. Optional PR Comment

The GitHub Action can post or update a sticky PR comment using:

```html
<!-- tautest:report v=1 -->
```

The full reports are also uploaded as artifacts.
