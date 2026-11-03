---
name: principle-fix-root-causes
description: "Reproduce a failure and repair the first wrong decision rather than hiding its symptom."
---

# Fix root causes

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Capture the smallest observable failure and trace backward to the first incorrect state or decision. Read actual errors and state; instrument when evidence is missing. If the state is legitimate, its unsupported handling may be the cause. If the state should never exist, find its producer before adding a guard.

For Clemora, trace UI state → HTTP contract and permissions → service → query/transaction → persisted result. Verify the active process and database target before interpreting runtime evidence. Restart-only failures warrant checking persisted state.

Search for the same defect pattern within the affected flow. Do not swallow errors, discard data, clamp values, or add retries merely to hide a fault. After repeated failed attempts, apply [attack the premise](../principle-attack-the-premise/SKILL.md). Propose a cheap diagnostic when a hidden deciding fact caused repeated investigation.
