# Review a Stryker report and prove a test fix

Keep your current Stryker command, configuration and CI. Start from the raw JSON report it already produces:

```bash
npx tautest analyze --from reports/mutation/mutation.json
```

Open `.tautest/review/report.md` for all actionable findings and `.tautest/review/fix-prompt.md` for a test-writing checklist. `review.json` preserves each mutant's id, location, replacement, covering tests and expression group. No project config is evaluated and no tests run during analysis; a report can be analyzed outside its original project. No AI service is called.

Choose a survivor with a real behavioral difference. Write the smallest test that passes on the original implementation and fails for that replacement. Then, from the package root, prove the target using its original id:

```bash
npx tautest verify --from reports/mutation/mutation.json --mutant 7 --test test/price.test.js --budget 180
```

Replace the sample id and test path with values from your project; add `--file src/price.js` if ids repeat. Install Stryker and its runner if they are absent. Verification uses the local Stryker configuration and its initial suite, mutates the selected source lines in a sandbox, and checks the exact mutant's executed killing test. Production source stays unchanged. An engine error, timeout, missing test attribution or failing initial suite cannot produce `verified`.

Inspect the printed `verification.json` path for the original report hash, source and test hashes, target identity, killing tests and execution outcome. The scoped verification report is evidence for that target, not a replacement for a full mutation score. Re-run your existing Stryker command and analyze the refreshed report to measure the remaining queue.

Analysis works with only a downloaded report. Recording decisions requires running `analyze` and `review` from a matching project checkout: each source file in the report must exist locally with the same contents. Without those files, the imported report is read-only. Repeating `analyze` in a folder containing only the report will not enable decisions. If the source has changed, generate a fresh Stryker report first. The [review snapshot limits](CLI_REFERENCE.md#tautest-review) also apply.

Some survivors are equivalent or an accepted risk. Use the full expression-group id from `review.json` and explain the judgment:

```bash
npx tautest review GROUP_ID --decision equivalent --reason "Document why each replacement has no observable difference"
```

This is a manual judgment covering every mutant in that group. It removes the group from the test-writing queue while preserving raw findings and score. Decisions expire when the report or snapshotted project files change. Tautest does not infer equivalence or award score credit for a review.

See [CLI Reference](CLI_REFERENCE.md#tautest-analyze) for supported configs, snapshot exclusions, limits and exit codes. These commands are additive; the existing changed-line `run` and GitHub Action workflow still work independently.
