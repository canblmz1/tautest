# Cloud Evaluation

## Position

Cloud and dashboard features should not be forced early. Tautest's core value must remain available through OSS CLI, reports, prompts, and GitHub Action artifacts.

A hosted product may become useful later, but only after local workflows prove repeat usage and teams ask for cross-PR history, policy, and collaboration.

## What Cloud Could Add

Potential user value:

- historical mutation score trends
- team/project dashboards
- recurring weak mutant categories
- flaky mutation run tracking
- organization-level policy
- pull request comparison across time
- saved prompt outcomes
- report sharing without digging through CI artifacts

What cloud should not be:

- required to run Tautest
- required to generate fix prompts
- required to view local reports
- a replacement for Stryker reports
- a reason to weaken OSS functionality

## When To Consider Cloud

Consider cloud only when at least three of these are true:

- 100+ public GitHub repos have used the GitHub Action.
- 20+ teams ask for historical tracking or shared dashboards.
- Users repeatedly upload or archive `.tautest/report.json` manually.
- More than 30% of issues mention trend visibility, policy, or team review workflows.
- The local historical tracking feature is used in real projects.
- Maintainers cannot debug adoption problems from local artifacts alone.
- There is clear willingness to configure upload tokens in CI.

Do not build cloud solely because dashboards look good in launch materials.

## Metrics To Track Before Building Cloud

OSS metrics:

- npm downloads for `tautest`
- GitHub Action usage count
- issue categories
- docs page interest if available
- number of external example repos
- repeat contributors

Product metrics:

- median mutation run duration
- percentage of no-op runs
- percentage of capped/skipped large PRs
- percentage of failed PR comments
- prompt eval success rate
- frequency of generated report artifacts

Cloud demand signals:

- requests for trend history
- requests for team policy
- requests for hosted report links
- requests for organization dashboards
- requests for central config

## Local First: Historical Tracking

Before cloud, ship local historical tracking:

```text
.tautest/history/
  runs.jsonl
  summaries/
    2026-05-10T120000Z.json
```

Capabilities:

- append local run summaries
- compare current score to previous run with same scope
- export history as JSON
- upload as CI artifact
- never send data remotely by default

Why this matters:

- validates whether trend data is actually useful
- creates a stable data model
- gives privacy-conscious users a complete workflow
- provides the input format a future dashboard would ingest

## Dashboard Timing

Dashboard should come after:

- monorepo beta is usable
- PR annotations are stable enough
- report schema is stable
- historical tracking is used
- at least one real team asks for cross-PR/project visibility

Dashboard should start as:

- static report viewer or local web UI
- no hosted auth
- no server dependency
- reads exported `report.json` and history files

Only after that should hosted dashboards be considered.

## Hosted Cloud Scope

If built, first hosted scope should be small:

- upload run summary
- store normalized report metadata
- show project trend
- link to CI artifacts
- show top recurring mutant types
- manage retention and deletion

Avoid early:

- deep code browsing
- hosted LLM test generation
- complex RBAC
- enterprise policy engine
- always-on agents
- replacing GitHub as the review surface

## OSS-Friendly Positioning

Messaging:

- OSS CLI is the product foundation.
- Cloud is optional history and collaboration.
- No local source upload by default.
- Users can inspect the exact JSON being uploaded.
- Users can self-archive reports as artifacts.

Required controls:

- explicit opt-in
- upload preview
- project-level disable
- retention settings
- delete project data
- export project data
- documented data schema

Never imply that mutation quality requires cloud.

## Data Model Boundaries

Safe initial upload fields:

- project slug
- commit SHA
- branch
- pull request number
- created time
- runner
- package name
- mutation score
- killed/survived/no-coverage counts
- capped/skipped reasons
- mutator names
- file paths if explicitly allowed

Sensitive by default:

- source snippets
- replacement code
- test names
- prompts
- full report JSON
- author identity

Default should avoid sensitive fields until users opt in.

## Security and Privacy Review

Before hosted cloud:

- threat model upload tokens
- define tenant boundaries
- design token rotation
- document retention
- design deletion/export
- decide whether source snippets are ever stored
- add audit logs for organization settings
- add abuse controls for public report links

## Pricing and Team Features

Do not decide pricing before proving usage.

Potential paid team features later:

- organization dashboard
- long-term retention
- team policy thresholds
- recurring weak spot reports
- Slack/GitHub summaries
- SSO and audit logs

Keep free/OSS:

- CLI
- core reports
- prompts
- GitHub Action
- local history
- artifact-based workflow

## Decision Gates

| Gate | Ship? | Requirement |
| --- | --- | --- |
| Local history | Yes, v1.5 candidate | Stable report schema and user requests for trends. |
| Static dashboard | Maybe | Users struggle to read JSON/Markdown history artifacts. |
| Hosted dashboard | Later | Repeated team demand and clear privacy model. |
| Team/cloud product | Much later | Teams need policy, retention, and cross-repo visibility enough to configure upload. |

## Recommendation

Do not build hosted cloud in v1.x. Build:

1. stable report schema
2. local historical tracking
3. artifact-friendly exports
4. optional static dashboard or report viewer

Revisit hosted cloud after v1.5 adoption data.

## Assumptions

- The v1 user base values trust and local control.
- Mutation reports can contain sensitive source and test context.
- GitHub artifacts and sticky comments are enough for early team workflows.
- Cloud is a potential product extension, not the foundation of Tautest.
