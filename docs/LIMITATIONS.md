# Limitations

These limitations are intentional product boundaries for the current release line, not a rewrite trigger. See the [architecture decision records](adr/0001-continue-not-rewrite.md) for the current direction.

- Tautest is not a mutation testing engine. It uses StrykerJS.
- Tautest does not replace Stryker HTML reports for deep mutation debugging.
- Runtime depends on project size and test speed.
- AI-author detection is best effort and can be wrong.
- The fix prompt is deterministic text. Tautest does not call an LLM unless `tautest prompt --suggest` is explicitly configured.
- Monorepo support includes a workspace beta for pnpm and package.json workspaces. It can plan and sequentially run selected packages, but dependency-graph expansion and concurrent execution are still future work.
- Python and Java runner work is alpha parser groundwork only. `tautest run` still supports JavaScript and TypeScript through StrykerJS.
- Tested Jest paths cover CommonJS, native ESM, and Babel TypeScript. Heavily customized transforms, custom environments, ts-jest, and complex ESM/CJS mixes may still need explicit Jest/Stryker configuration.
- Vitest browser mode may need manual configuration or may not work in v1.
- Complex path aliases, custom loaders, Babel transforms, ts-jest, and ESM/CJS mixed projects may need explicit Stryker config.
- GitHub Action PR comments depend on repository permissions.
- `pull_request_target` can be dangerous for untrusted code and is not the default recommendation.
- The CLI requires Node 20 or newer and release readiness runs on Node 20 and Node 24.
- GitHub Action currently uses the Node 20 action runtime; Node 24 action runtime migration is tracked separately.
- Cache hit was not proven in the v1 smoke, but graceful cache handling was validated.

## Support tier summary

| Area | Tier |
| --- | --- |
| Vitest JS/TS execution | Supported |
| Jest JS/TS execution | Beta |
| pnpm and `package.json` workspace execution | Beta |
| Python and Java runner work | Alpha parser groundwork |
| Automatic LLM calls | Opt-in suggestion flow only |
| Hosted dashboard | Out of scope |
