AI Engineering Fluency: smaller report-only trial

Upstream: rajbos/ai-engineering-fluency, issue 2341
Report: https://github.com/rajbos/ai-engineering-fluency/actions/runs/39218400571
Frozen head: 5f703c0610709c89acb365fe42b27450608b2fc8
Original artifact: mutation-report, id 12173646675.

The original mutation.json is 439,247,725 bytes. Published Tautest 2.1.2
rejects it at its 128 MiB import limit. 421,283,285 string characters are
in 3,096 mutant statusReason fields containing diagnostic text.

The attached compact report is 1,020,441 bytes. ONLY mutant statusReason
strings were omitted. It is not a byte-identical raw report: retain the
original for failure explanations. JSON formatting changed; every other
JSON event (key, string, number, array/object boundary) has the same ordered
SHA-256 fingerprint as the original. Source, identities, statuses, locations,
counts, test references, configuration and metadata are preserved. Original
input SHA-256 and compact output SHA-256 are in compaction.json.

Reproduction recipe: scripts/adoption-proof/large-report/compact.py.
Install ijson==3.6.0 for the Python recipe; the prepared JSON trial below
does not require Python. Pass original report, new compact file and new
compaction-evidence file to the recipe. It streams the original input and
checks the omitted-field-only invariant before publishing its output.

Published Tautest 2.1.2 imports the compact file successfully, complete=true:
4,143 total, 3,096 Killed, 1,033 Survived, 14 Timeout; 868 expression groups.
The existing issue's score uses a different timeout convention, so equal
counts do not imply the same displayed score. No equivalence was judged.

The upstream runner is command/Node tests on compiled out/*.js. Do NOT set
--runner vitest or jest: no engine execution, test-fix prompt or Tautest
verification is being offered. Its report has no per-test coverage names;
those cannot be manufactured. This trial shows source expressions/groups.

After downloading compact.mutation.json:
  npx --yes tautest@2.1.2 analyze --from compact.mutation.json
Open .tautest/review/report.md or review.json.

No upstream source/test/config was edited and no mutation campaign rerun.
This is our own experiment, not external adoption. Upstream MIT license
and copyright are retained in PROJECT-LICENSE for the embedded source.
