# AI domain guidance

Started: 2026-11-16T13:47:50+08:00
Updated: 2026-11-16T13:52:40+08:00
Status: complete
Scope: User authorized context-factory documentation for the agreed AI structure, examples, standards, naming, and one-shot prompt; no application implementation.
Checkout: feat/ai, aed6d03; pre-existing apps/api/.env.example modification preserved.
Continues: none (first AI-specific guide; previous structure discussion was read-only in this chat)

## Goal

Give later contributors a discoverable AI area that fits the existing role/area/workflow/reference pattern and explains each proposed file without implying that the assistant already exists.

## Result

Added [AI](../areas/ai/SKILL.md), with separate structure/naming, execution/verification, connected code-example, and one-shot prompt references. The router, API area, root README reference list, and manual routing scenarios point to the new guidance. Product scope and current implementation status are unchanged.

## Changes or findings

- The starting location is `apps/api/src/services/ai/`; tools reuse existing business services and bind authenticated customer scope. HTTP, SQL, configuration, shared contracts, and schema retain existing owners.
- All 13 discussed files have examples. Proposed env getters, optional routing/retrieval, draft intake/handoff, and future HTTP/persistence behavior are explicitly distinguished from current source.
- Luna mapped current routes; Terra drafted examples; independent Sol reviewed the complete docs. Corrected factory/entry names, env-owned model selection, stable retrieval source identity, cancellation forwarding, and preservation of earlier run records.

## Decisions

The [structure reference](../areas/ai/references/structure-and-naming.md) owns placement and naming. The [standards reference](../areas/ai/references/standards-and-verification.md) records selected model roles, safe tool/context practices, and evidence boundaries. Knowledge approval, handoff ownership, and submission behavior remain product decisions; this documentation does not authorize them.

## Verification

Passed: guidance link/metadata/routing check (110 documents, 13 skills), all nine checker tests, independent review, scoped explicit Markdown formatting, and whitespace/diff audit. Walked the AI design-only, implementation/review, one-shot prompt, documentation, and continuation routes from root guidance through their actual targets. All 13 snippets plus the proposed env getter compiled in memory against current source and installed `ai@7.0.173` with zero diagnostics. Exact selected models appeared in the public catalog; no authenticated inference occurred. Application/database/browser/provider runtime behavior was not exercised.

## Remaining work

No documentation work remains. Application implementation is separate; the assistant, knowledge adapter, and handoff remain unimplemented. No application code, env changes, migrations, database/provider operations, or UI implementation were performed.

## Resume here

Read [AI](../areas/ai/SKILL.md) and current Git/source before a later implementation. Adopt the [one-shot prompt](../areas/ai/references/one-shot-prompt.md) only for an explicitly authorized slice; preserve the unrelated environment edit and earlier runs. This task does not authorize commits, deployment, or paid calls.
