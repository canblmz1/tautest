# Release 2.1.5 availability control

The user explicitly approved publishing both public packages as 2.1.5. Version PR #54 was merged only after its inspected head had 13 successful checks. The [Release run](https://github.com/canblmz1/tautest/actions/runs/39842845088) reported both packages published at 19:46:18 UTC on 22 October 2026.

That successful publisher exit was insufficient: CLI metadata/tarball became accessible first; core metadata initially returned 404, then named 2.1.5 while its referenced tarball still returned 404. A fresh installation failed fetching that core dependency. The [retained summary](summary.json) includes the actual public registry snapshot and timestamps. The underlying cause of the visibility difference is unknown; no second publish was attempted.

Later both exact tarballs downloaded and matched the registry's SHA-512 integrity. An independent new-directory installation with an empty npm cache and empty user config installed registry `tautest@2.1.5` and resolved core 2.1.5, with no local file dependency, override or older-core fallback. A separate real Windows/Node22/pnpm10.33.1 control with Vitest4.1.8/Stryker10 passed `init`, `doctor`, diff-selected `run`, `analyze` and published `verify`. Its new boundary test killed the exact executed survivor; applying the replacement directly failed the behavior assertion and restoring source passed. Source bytes were preserved.

These are maintainer controls, not independent adoption or a performance comparison. The npm empty-cache install and the full pnpm control are distinct; the latter reused the pnpm store.

## Preventing a misleading green release

The separate release fix adds a read-only strict verification mode to the existing release decision helper. It downloads both exact tarballs and checks their integrity. Metadata alone, missing distribution data, tarball 404, mismatched bytes, misaligned versions and response-body timeout cannot produce success. Temporary visibility errors are retried within the workflow's eight-minute limit.

The original pre-publish decision table remains metadata-only and keeps its partial-publish refusal. The post-check cannot publish, modify credentials or change permissions. It runs after an actual publish or a no-op where the current versions already exist; it skips the version-PR preparation path, which intentionally contains an unpublished next version.

Before the fix, four new local-HTTP regression cases failed with actual expectation differences. They cover missing/corrupt artifacts, retry and missing distribution metadata. Additional CLI, version-alignment and delayed-body cases protect the final behavior. Local lint/typecheck/build and workspace tests are recorded in the PR; known Windows script-test failures are kept separate. No source mutation, score change or new package version is introduced by this verification change; its Changeset is for a future approved maintenance release.

Raw local logs and the complete published 2.1.5 control remain under `C:/dev/tautest-product-evidence/2026-10-22/roadmap-continue`. The small public JSON includes hashes, observed statuses, the resolved versions and exact-target identity. It does not claim the npm visibility delay's cause was fixed.
