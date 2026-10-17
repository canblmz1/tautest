# Tautest CLI

PR-focused mutation testing CLI powered by StrykerJS.

Already use Stryker? Analyze its raw JSON report without changing configuration or running tests:

```bash
npx tautest analyze --from reports/mutation/mutation.json
```

The report-only path needs no installed mutation engine or Git repository. It writes `.tautest/review/report.md`, `review.json` and `fix-prompt.md`. Manual reviews keep the raw mutation score unchanged and expire when the report or project files change.

After writing a test, verify its exact target in Stryker's sandbox:

```bash
npx tautest verify --from reports/mutation/mutation.json --mutant 7 --test test/price.test.js --budget 180
```

Use the actual mutant id from your report. Verification requires installed Stryker and its runner, current source matching the report, a passing initial suite, and an executed killing test in the selected file. A failed run or exhausted budget never counts as a verified fix. Existing local Stryker config is used; use `--runner vitest` or `--runner jest` if no runner is configured or recorded.

For changed-line mutation testing:

```bash
npm install -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
npx tautest init --yes --runner vitest --no-install
npx tautest run --base origin/main
```

Tautest is not a mutation engine. It uses StrykerJS and adds changed-line scoping, readable reports, AI test-fix prompts, and GitHub PR workflow support.

Docs: https://github.com/canblmz1/tautest#readme
