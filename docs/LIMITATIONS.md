# Limitations

- Tautest is not a mutation testing engine. It uses StrykerJS.
- Tautest does not replace Stryker HTML reports for deep mutation debugging.
- Runtime depends on project size and test speed.
- AI-author detection is best effort and can be wrong.
- The fix prompt is deterministic text. Tautest does not call an LLM.
- Monorepo support is limited in v1. Tautest detects and warns, but does not orchestrate all workspace packages.
- Jest support is beta.
- Vitest browser mode may need manual configuration or may not work in v1.
- Complex path aliases, custom loaders, Babel transforms, ts-jest, and ESM/CJS mixed projects may need explicit Stryker config.
- GitHub Action PR comments depend on repository permissions.
- `pull_request_target` can be dangerous for untrusted code and is not the default recommendation.
- GitHub Action currently uses Node 20; Node 24 migration is planned.
- Cache hit was not proven in the v1 smoke, but graceful cache handling was validated.
