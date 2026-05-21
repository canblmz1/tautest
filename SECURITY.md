# Security Policy

## Reporting A Vulnerability

Please report security issues privately before opening a public issue.

Use GitHub's private vulnerability reporting if it is enabled for the repository. If it is not enabled, contact the maintainer through the repository owner profile and include enough detail to reproduce the issue safely.

## Scope

Security-sensitive areas include:

- GitHub Action token handling and PR comment behavior
- command execution and package-manager invocation
- path handling for `working-directory`, reports, and artifacts
- Markdown/HTML injection in PR comments and job summaries
- accidental secret logging

## Product Boundary

Tautest runs tests and StrykerJS on user code. That is code execution by design. For untrusted pull requests, use the documented `pull_request` workflow with minimal permissions and avoid `pull_request_target` unless you fully understand and mitigate the risk.

Tautest does not call LLM APIs and does not send source code to AI services.

For operational safety guidance, see [docs/TRUST_AND_SAFETY.md](docs/TRUST_AND_SAFETY.md).

## Supported Versions

Security fixes target the latest released version.
