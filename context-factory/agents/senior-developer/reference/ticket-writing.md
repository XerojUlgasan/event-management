# Ticket writing

Create or rewrite implementation, bug, spike, and Epic tickets with clear scope, business rules, evidence, and verifiable outcomes. Use when turning product needs, defects, or unresolved questions into actionable work for a project team.

Write concise tickets that Product, Design, Engineering, and QA can use without reconstructing the original conversation.

## Repository context

Read the root [repository guidance](../../../../AGENTS.md) and the area skills relevant to the ticket. Use the root README's [current implementation](../../../../README.md#current-implementation), setup, and [product scope](../../../../README.md#product-scope) for intended workflows and unresolved business decisions. Verify current behavior in source; distinguish requested new behavior from existing capabilities and proposals.

Trace the actual screen, API, and persistence before describing a workflow as implemented. For authenticated reproduction or database evidence, use the [QA skill](../../../QA/SKILL.md). Record which evidence was collected and which checks were unavailable; a demo screen or passing build alone does not prove a persisted workflow.

## Choose the ticket type

| Type | Use when | Required result |
|---|---|---|
| [Implementation](tickets/implementation-ticket.md) | An agreed feature, enhancement, or behavior change is ready to build. | A defined capability with testable acceptance criteria. |
| [Bug](tickets/bug-ticket.md) | Existing behavior differs from an established expectation. | A reproducible failure and a clear definition of the restored behavior. |
| [Spike](tickets/spike-ticket.md) | Uncertainty prevents a product, design, or engineering decision. | Evidence, a recommendation, and identified follow-up work. |
| [Epic](tickets/epic-ticket.md) | One outcome needs multiple independently deliverable tickets. | Shared direction and scope, with related tickets grouped under it. |

Read only the guide for the selected ticket type before drafting. For mixed requests, read each applicable guide and create separate tickets using the appropriate formats. When an Epic needs child tickets, use the Epic format for the parent and the matching format for each child.

## Shared writing rules

- Read the supplied requirements and relevant existing sources before drafting. Link evidence where it helps a reader verify a claim.
- Separate confirmed facts, approved requirements, proposals, and unknowns. Do not invent business rules or present assumptions as decisions.
- Keep context to one or two short paragraphs. Explain the problem, affected user, reason, and desired outcome.
- Describe deliverables as product or system capabilities. Put technical decomposition in an engineering plan or subtasks, unless a technical constraint is an approved requirement.
- Preserve approved formulas, thresholds, permissions, scope boundaries, and unusual edge cases when rewriting a ticket.
- Use stable identifiers: BR-01 for business rules, PR-01 for permission rules, and AC-01 for acceptance criteria.
- Make rules deterministic. Another person must be able to predict the result from the stated conditions.
- Make acceptance criteria independently verifiable. Cover every deliverable and the material business, permission, validation, and edge-state behavior.
- Reference rule identifiers instead of repeating complicated logic. Keep repository-wide quality checks and the team's Definition of Done separate from feature correctness.
- Use the project's established terminology and priority or severity scale. If no scale exists, describe the concrete impact.
- Remove secrets and sensitive personal or production data from evidence.

Append an Open questions section only when a missing or contradictory decision materially affects expected behavior, reproduction, scope, or the decision being investigated. Ask the minimum necessary questions. A draft with unresolved behavior decisions is not ready for implementation.

## Publish when requested

Drafting a ticket and publishing it are separate actions. Publish when the user's request authorizes it.

Use the target project's documented tracker workflow and configured tools. Before writing, verify the destination, account, required ownership fields, available labels, and parent relationship. Use existing field values. Resolve missing required configuration before creating the issue.

Prefer the project's supported creation helper when one exists. Save the exact ticket body to a file or pass it as a structured argument to preserve Markdown.

After publishing, verify the created ticket's content, project placement, required fields, and parent relationship. If a write fails partway through, inspect the existing state before retrying to avoid duplicates. Return the ticket link and disclose any incomplete organization steps.

## Check the draft

- The ticket type matches the work and uses the corresponding format.
- Confirmed requirements and proposals are distinguishable.
- Rules predict the result without a hidden business decision.
- Scope establishes a clear completion boundary.
- Every deliverable has an observable completion check.
- Evidence supports factual claims, and material unknowns remain explicit.
- A spike has a decision, evidence requirements, timebox, and stop conditions.
- An Epic's children are self-contained and grouped consistently.
