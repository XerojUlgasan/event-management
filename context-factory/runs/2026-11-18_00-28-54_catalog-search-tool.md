# Public catalog search tool and execution records

Started: 2026-11-18T00:28:54+08:00
Updated: 2026-11-18T00:45:00+08:00
Status: complete
Scope: Approved first assistant tool, separate tool-call persistence, and additive local migration. No hosted deployment, application-record writes, paid provider calls, commit, or push.
Checkout: main at 99bf310; initially clean. This task's changes remain uncommitted.
Continues: [AI file separation](2026-11-16_20-52-19_ai-file-separation.md); current catalog ownership follows [catalog/canvas layering](2026-11-18_00-07-56_catalog-canvas-layers.md).

## Goal

Implement package/service search with exact filters, optional semantic ranking, five-result scoped pagination, and many tool-call records per triggering customer message and resulting assistant message. Verify privacy, persistence, failures, replay, guest scope, and takeover.

## Result

Implementation, additive local migration, integrated verification, documentation, and final audit are complete. The local table is empty; no application records were changed.

## Changes or findings

- Public search reuses current embedding/freshness operations while excluding archived/private/unpublished owners and distinguishing provider failure from empty results. Semantic results deduplicate by listing.
- The SDK agent has a shared deadline, bounded steps/calls/results, a reserved answer step, and no automatic retries. Tool execution rechecks current conversation ownership and AI version.
- Audit records retain tool name, SDK call ID, turn ID, validated inputs, projected results/errors, and timing. Resulting-message links commit with the reply. Prior pagination comes only from a delivered earlier same-conversation search.
- Terra implemented search and fixtures; Luna implemented storage; the lead integrated the assistant. Independent Sol source review found no actionable issues.

## Decisions

See [accepted design](../history/decisions/2026-11-18_catalog-search-and-tool-calls.md). Business-information retrieval and inquiry drafting remain roadmap items; other proposed tools are outside this slice.

## Verification

All migrations replayed in a disposable local database; generated DB types came from that database, which was dropped. The combined serial suite passed 54/54 checks: 25 assistant, 15 guest, six storage, four search, and four Edge route checks, using synthetic providers and disposable databases. API type check, Prisma validation, Edge build, centralized environment check, scoped formatting, whitespace, guidance structure, and nine guidance tests pass. The confirmed local target had exactly one pending migration; applying it succeeded, and readback verified the empty audit table, RLS, and recorded migration. No live provider, served Edge/browser, or hosted proof.

## Remaining work

No required implementation work remains. Hosted rollout, served-runtime/browser verification, and representative live-model evaluation are separate work. Other proposed tools remain outside this slice.

## Resume here

Review the uncommitted diff beginning with `services/ai/search-public-catalog.ts`, the SDK tool/agent, the migration, and `data/ai/*tool*`. The local migration is already applied. Deploy matching migration/API together elsewhere; do not rerun embeddings or live-model evaluations without their intended authorization.
