# AI architecture guidance refresh

Started: 2026-11-18T19:35:57+08:00
Updated: 2026-11-18T19:41:43+08:00
Status: complete
Scope: Documentation of the existing assistant/tool architecture, concise extension guidance, and contributor-guidance verification. No application code, database, running-service, provider, commit, or push changes.
Checkout: main at 0d0d26f; initially clean.
Continues: [Public catalog search tool](2026-11-18_00-28-54_catalog-search-tool.md).

## Goal

Make the AI area explain the implemented architecture so future agents can extend it consistently without following obsolete scaffolding or repeated rules.

## Result

Replaced proposed implementations with source-linked current guidance. The source audit, affected routing walkthrough, and documentation checks are complete.

## Changes or findings

- The AI entry routes to ownership, a current code walkthrough, execution standards, and a scoped assignment template. Ownership, explanation, and invariants each have a dedicated home.
- The walkthrough explains explicit tool registration, model-facing descriptions/schemas, server execution, and the message-to-reply path.
- Standards cover server-bound conversation/customer/message scope; many tool calls per trigger/reply; attempt/call/tool identity; atomic reply links; incomplete records; tracking failures; and current versus indexed evidence.
- Removed obsolete parallel implementations and cached model selections. Root README still owns capability status/configuration. Existing historical links remain supported.
- Updated the root reference and affected routing scenarios. The lead authors the docs; a Luna agent checks architecture claims against source without edits or runtime side effects.

## Decisions

No new product or architecture decision. The [accepted search decision](../history/decisions/2026-11-18_catalog-search-and-tool-calls.md) remains historical rationale; current instructions live in the AI area.

## Verification

Guidance structure/links and all nine guidance tests pass; scoped formatting and whitespace checks pass. Walked root routing for architecture investigation, tool/prompt/retrieval implementation or review, task-template reuse, guide editing, and continuation. Their selected references preserve the intended scope and completion boundary. A read-only Luna audit checked the five AI documents against source; the lead verified and applied its two wording refinements about saved replies and separate semantic SQL. Application behavior tests and live-provider calls were not run for this documentation-only change.

## Remaining work

No required documentation work remains. Runtime/provider evaluation remains separate from these structural checks.

## Resume here

Start at [AI](../areas/ai/SKILL.md) and its four references. Confirm their claims against current source before extending tools. This run does not authorize another capability or deployment.
