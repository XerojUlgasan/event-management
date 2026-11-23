# Catalog indexing scheduling

Started: 2026-11-19T21:52:00+08:00
Updated: 2026-11-19T21:57:00+08:00
Status: complete
Scope: User-approved queue-level ensure-scheduled semantics, truthful counts, regression verification and independent review. No application database writes, live provider calls, commits or deployment.
Checkout: main at 4131b0d; extensive pre-existing API, message, catalog, UI and guidance changes preserved.
Continues: [Knowledge background indexing](2026-11-19_20-48-44_knowledge-background-indexing.md).

## Goal

Repeated Index pending requests leave pending/running jobs and retry timing untouched, while actual catalog-save successors, worker recovery and terminal retries remain functional.

## Result

Terra implemented the queue ensure operation and owner-locked freshness reassessment. The lead integrated contracts, UI and current documentation, inspected the scoped delta, and independently ran the original reproducer and checks. Sol independently reviewed source and tests without actionable findings.

## Changes or findings

Manual scheduling locks each owner before assessing fresh source and ensuring scheduling under the queue lock. Existing jobs receive no writes. The response counts new inserts, skipped active/current/ineligible/missing owners, and failed submissions separately. Catalog saves retain refresh enqueue semantics. Public Button, PageHeader, notifications and existing styles/tokens were reused; no shared presentation changes were needed.

## Decisions

The [accepted scheduling decision](../history/decisions/2026-11-19_catalog-index-scheduling.md) replaces manual successor creation and retry resets. Historical implementation records remain intact.

## Verification

- Original gated-provider HTTP/worker assertion failed before the fix (two jobs versus one). Afterward, concurrent clicks and three provider-failure/retry cycles retained one row, with attempts advancing normally.
- Disposable pgvector/synthetic provider: catalog 51 passed, four client-role probes skipped; queue/standalone worker 11 passed; Edge route checks five passed. Coverage includes real edits processed by successors, concurrent requests, full-row retry preservation, completion/archive/delete races, terminal retries, cancellation and partial counts. The final catalog test repaired a fixture isolation error; a first standalone-worker connection-termination failure passed on rerun.
- API/web/UI types, web/Edge builds, full ESLint, scoped Prettier, environment checks, guidance navigation and all nine guidance tests passed. Relevant routing scenarios were walked.
- Synthetic browser feedback covered keyboard/pending controls, new/mixed/skipped/partial/empty/error outcomes, one reload per submission, Refresh without submission, and narrow text wrapping without horizontal overflow. This did not use application data.

## Remaining work

No required implementation work remains. Full workspace check stops at existing use-thumbnail library placement issues; design checks retain existing catalog controls/colors and message-image color findings. Hosted deployment, authenticated browser-to-application-data flow and live provider quality remain unverified.

## Resume here

Review the scoped diff and deploy matching API/frontend during an authorized rollout. No schema migration is required. Real edits and terminal retries may still add job history; provider execution remains at least once.
