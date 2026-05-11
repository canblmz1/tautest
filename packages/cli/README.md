# Tautest CLI

PR-focused mutation testing CLI powered by StrykerJS.

```bash
npm install -D tautest @stryker-mutator/core @stryker-mutator/vitest-runner
npx tautest init --yes --runner vitest --no-install
npx tautest run --base origin/main
```

Tautest is not a mutation engine. It uses StrykerJS and adds changed-line scoping, readable reports, AI test-fix prompts, and GitHub PR workflow support.

Docs: https://github.com/canblmz1/tautest#readme
