---
name: amac-implement
description: Implement, debug, or refactor AMAC code or configuration with coherent contracts, scoped changes, and verifiable outcomes.
---

# Implement

Use after the requested change and affected flow are understood. Select the owning areas through the [router](../../README.md); use [Investigate](../investigate/SKILL.md) first for material uncertainty.

## Change and verify

1. Turn the full requested outcome into observable acceptance criteria. Capture a useful baseline and identify constraints, consumers, risky unknowns, and the proof each requires.
2. Read [implementation principles](references/principles.md). For novel consequential design, compare candidates through [design](../investigate/references/design.md); follow existing patterns for routine work.
3. Sequence coherent units with a before/change/after check. Keep inseparable contracts and callers together; temporary local breakage must be reversible and closed before delivery. Isolate independent writers.
4. Make the smallest sufficient change at the established owner. Verify each unit before dependent work; an inconclusive result is not a pass. Inspect real output and revise the approach when evidence contradicts it.
5. Audit the integrated artifact against every acceptance criterion, affected current docs, the final diff, and selected area requirements. Report actual checks and gaps. Retain a [run](../../runs/README.md) for multi-session work and a [decision](../../history/decisions/README.md) for lasting choices.

## Additional reading

| Change | Required reference |
| --- | --- |
| Any TypeScript investigation/edit/review | [TypeScript](references/typescript.md) |
| Filenames, identifiers, domain placement | [Naming](references/naming.md), plus owning area structure |
| Shared contract, schema/state, permissions, or indirect consumers | [Contract changes](references/contract-changes.md) and [API/type synchronization](../../areas/contracts/references/api-type-sync.md) |
| Explicit TDD or practical regression proof | [TDD](references/tdd.md) |
| Choosing commands, targets, capabilities, or test setup | [Local tools](references/local-tools.md) |
| Any UI change | [Frontend](../../areas/frontend/SKILL.md), [packages](../../areas/packages/SKILL.md), [reuse workflow](../../areas/packages/references/reuse.md) |

Use existing tests that could expose the mistake; add behavior tests when justified. Reversible prose/style changes do not automatically need new tests.
