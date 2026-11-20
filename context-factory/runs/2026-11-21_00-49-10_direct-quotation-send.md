# Direct quotation sending and package add-ons

Started: 2026-11-21T00:49:10+08:00
Updated: 2026-11-21T00:58:49+08:00
Status: complete
Scope: Implement and verify package-owned quotation add-ons, confirmed package mutations, and direct Send or Cancel.
Checkout: main at f17d2a1a4c9946004e3b5c59fe01ec1640bc1e93 with pre-existing uncommitted add-on and inline quotation work.
Continues: [Inline quotation editing](2026-11-21_00-11-00_inline-quotation-editing.md).

## Decisions

[Package-owned add-ons and direct quotation sending](../history/decisions/2026-11-21_direct-quotation-send.md) records the authorized workflow. Legacy unsent records are retained and have no active editor.

## Result

The quotation editor prepares a temporary offer from the current private package and its mandatory add-ons. Confirmed edits and removals use the private package controls and persist immediately. Cancel discards hours, adjustments and any revision reason without writing quotation records. Send commits an offer, its linked conversation message, audit, and any supersession in one transaction. A revision uses the current package and keeps earlier delivered versions readable.

## Verification

- Isolated PostgreSQL 17 with pgvector replayed all 76 migrations. The API quotation suite passed 22 tests. Package and media coverage passed 38 tests. Seed preservation, conversation migration, proposal tool and Edge dispatch checks passed.
- Actual Chromium and the local Node API exercised preparation, modal cancellation, private package edits and removal read back from PostgreSQL, rejected delivery and retry, revision cancellation, a 390 px send, and customer history. The private package base fields, global service row, and first sent amounts were compared before and after.
- The isolated Edge bundle passed 11 route and auth checks. Authenticated preparation and two copies of one send request produced a single next version.
- Quotation DOM passed 27 tests, catalog DOM and validation passed 35, and latest offer passed 4. Web types/build, UI types, workspace lint, guidance checks, and whitespace passed. Existing guest chat test typing and thumbnail import boundaries prevent the corresponding aggregate checks from passing. The design checker retains unrelated baseline findings.
- Independent GPT-6.2 Sol review cleared the integrated implementation after repairs. Verification used this checkout on task-owned services.

## Resume here

For rollout, confirm the target has the quotation add-on migration before deploying the matching API and web together. Hosted behavior is unverified. Existing unsent rows are retained outside the editor.
