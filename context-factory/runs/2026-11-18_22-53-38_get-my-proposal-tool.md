# Conversation-scoped proposal tool

Started: 2026-11-18T22:46:49+08:00
Updated: 2026-11-18T22:53:38+08:00
Status: complete
Scope: User-approved implementation of getMyProposal with no model arguments and full original widget content. No deployment, live provider calls, configured application-data writes, migrations, commit, or push.
Checkout: main at 5939511; initially clean. Changes remain uncommitted.
Continues: [Public catalog item tool](2026-11-18_20-29-13_public-catalog-item-tool.md).

## Goal

Return the current conversation's proposal as structured JSON, preserving sections/widgets and every full Markdown string. Keep customer/conversation scope server-owned and verify access, empty states, audit linkage, and human takeover.

## Result

Implemented the [proposal service](../../apps/api/src/services/ai/get-my-proposal.ts) and [SDK adapter](../../apps/api/src/services/ai/tools/get-my-proposal.ts), registered only for customer turns. The existing owned booking-package service resolves custom proposals before the original catalog choice. Results distinguish found, no linked request, and package not prepared; failures remain errors.

## Changes or findings

- Empty strict input rejects model-selected identities and selectors. In-flight guest claims retain the original guest capability set.
- Full JSON preserves authored text, layout, media, and linked widgets without flattening or recursive expansion. Audit records retain a result hash, character count, status, and bounded metadata instead of copying private text.
- Proposal results cumulatively consume the remaining context/history character budget; oversized responses fail explicitly rather than truncating. All tools share the existing six-execution budget.
- Terra authored focused tests. Independent Sol source review found no actionable issues. The lead integrated implementation, strengthened large-result/shared-budget tests, corrected fixture constraints and removed a redundant assertion that could match random cursor data.
- README and AI ownership/walkthrough/standards now describe this capability. Historical sources remain intact.

## Verification

59 focused synthetic-provider/API/disposable-PostgreSQL checks pass across proposals, assistant turns, guests, and tool audits. The proposal service's two tests also pass after adding an explicit catalog-fallback assertion. API types, Edge bundling, guidance checks and nine guidance tests pass; final formatting/diff checks and routing walkthrough are recorded with delivery. An earlier guest teardown emitted asynchronous connection activity; the final serialized run passed. No browser, served Edge, hosted rollout, or real model selection/interpretation was tested.

## Remaining work

No required implementation remains for this slice. Live-provider and hosted-runtime verification remain separate.

## Resume here

Review the scoped diff, starting with the proposal service/adapter and tests. No new migration or endpoint is needed. Preserve JSON sections/widgets and server-bound scope in follow-up work.

