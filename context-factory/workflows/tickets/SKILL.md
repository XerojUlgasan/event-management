---
name: clemora-tickets
description: Create or rewrite implementation, bug, spike, and Epic tickets with deterministic rules, source evidence, and observable completion criteria.
---

# Tickets

Establish scope from approved requirements, the root README, matching business rules, and current source. Trace actual screen/API/persistence before claiming an implemented capability. Use [QA](../qa/SKILL.md) for authorized reproduction evidence.

## Choose one format

| Type | Use when | Template |
| --- | --- | --- |
| Implementation | An agreed capability is ready to build | [Implementation](templates/implementation-ticket.md) |
| Bug | Existing behavior violates an established expectation | [Bug](templates/bug-ticket.md) |
| Spike | Uncertainty prevents a decision | [Spike](templates/spike-ticket.md) |
| Epic | One outcome spans independently deliverable tickets | [Epic](templates/epic-ticket.md) |

Read the selected template before drafting. Mixed requests may need several types; keep each child self-contained.

## Draft and verify

1. State the problem, affected user, desired outcome, and scope briefly. Separate confirmed facts, approved requirements, proposals, and unknowns. Preserve supplied formulas, limits, permissions, and edge cases.
2. Make rules deterministic and criteria independently observable. Use BR-01, PR-01, and AC-01 identifiers where the template calls for them; reference complex rules rather than repeating them. Every deliverable needs a completion check.
3. Put technical decomposition in engineering notes/subtasks unless it is an approved constraint. Keep repository-wide quality checks separate from feature correctness. Material open decisions remain questions; the ticket is not implementation-ready while expected behavior is unresolved.
4. Publish only when authorized. Verify tracker destination/account/fields/labels/parent; use existing values. Preserve exact Markdown with structured arguments or a body file. Inspect partial writes before retrying and read back the created artifact, relationships, and content.
5. Deliver the draft or verified ticket link, evidence, and unresolved decisions. A spike needs evidence requirements and stop conditions; an Epic needs coherent, self-contained children.
