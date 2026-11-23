# Public catalog item tool

Started: 2026-11-18T20:21:30+08:00
Updated: 2026-11-18T20:29:13+08:00
Status: complete
Scope: User-approved implementation of the read-only catalog detail tool after Markdown-output design. No deployment, live provider calls, application-data writes, or migration changes.
Checkout: main at 4107b13; pre-existing package-service cleanup changes preserved.
Continues: [Public catalog search](2026-11-18_00-28-54_catalog-search-tool.md); current extension guidance follows [AI architecture guidance](2026-11-18_19-40-01_ai-architecture-guidance.md).

## Goal

Add `getPublicCatalogItem` for packages/services with current facts and original ordered canvas content presented as Markdown. Preserve public visibility, bounded continuation, audit linkage, guest scope, and human takeover. Omit the removed legacy Included/Optional service lists.

## Result

The tool is registered in the existing assistant. Its service reads public records directly without embeddings, preserving Markdown, media descriptions/references, and visible linked listings. It records `{ markdown, nextCursor }` and presents text through `toModelOutput`. Pages contain up to 4,000 source Unicode code points, remain below the serialized audit budget, and bind cursors to rendered source identity/content. Related canvases are not recursively expanded.

## Changes or findings

- Search and detail share six execution slots and the existing proposal/deadline limits.
- The earlier-call query now supports both tool names. Later turns receive only validated selectors/cursors from earlier delivered replies in the same conversation, without cached text or prices.
- Terra implemented the detail service/query and focused fixtures. The lead integrated the SDK adapter, context, prompt, regression tests, and docs. Independent Sol source review found no actionable issues.

## Verification

59 focused checks pass across detail, search, assistant turns, execution storage, and guests using disposable migrated PostgreSQL databases and synthetic providers. They cover Markdown model input, public/private exclusions, pricing, media, ordering, Unicode reconstruction/size, stale cursors, replay, audit linkage, shared budgets, and takeover. API types, Edge bundling, scoped formatting, guidance checks and nine guidance tests pass. The affected AI-extension/documentation routing scenarios were walked. An initial fixture-name collision was corrected before the passing run.

## Remaining work

No required implementation work remains. Browser, served Edge, hosted rollout, and live-model interpretation were not tested. The unrelated package-service removal remains owned by its separate task.

## Resume here

Review the new detail service/query/tool and integrated assistant tests. Deploy the matching API separately when authorized; this feature requires no new migration.
