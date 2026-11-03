---
name: principle-migrate-callers-then-delete-legacy-apis
description: "Change an internal contract and its callers coherently, with a bounded rollout for independent deployments."
---

# Migrate callers, then delete legacy APIs

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Find every consumer before replacing an internal API. Update implementation, shared types, tests, browser calls, examples, and relevant docs in the same coherent change, then remove the obsolete path when no supported caller remains.

Do not retain a permanent compatibility wrapper for convenience. Independently deployed API/browser versions or external consumers need a coordinated rollout or bounded compatible transition with an explicit deletion step. One PR does not make deployment atomic.

Preserve existing camelCase JSON unless a contract change is requested. Follow [API synchronization](../../shared/api-type-sync.md) and [pull requests](../pull-requests/SKILL.md). Do not edit applied migrations or erase historical records to simplify a refactor.
