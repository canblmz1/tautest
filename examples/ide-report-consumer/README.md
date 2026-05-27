# IDE Report Consumer Example

This tiny example shows how an editor extension can consume `.tautest/report.json` without importing Tautest internals.

```bash
pnpm --filter tautest-example-ide-report-consumer test
node examples/ide-report-consumer/index.mjs .tautest/report.json --json
```

The script maps `surviving[]` entries to diagnostics with `file`, `line`, `severity`, `code`, `message`, and `detail` fields. Real extensions should validate `version` and `schemaVersion`, then render these diagnostics through the editor API.
