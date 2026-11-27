# Validate IT capstones

Critically validate Philippine IT capstone ideas or proposals for problem evidence, client demand, usability, net convenience, feasibility, accessible dependencies, differentiation, safety, and measurable evaluation. Give PASS, CONDITIONAL PASS, REVISE, or REJECT.

Use the [documentation agent](../../../agents/documentation.md). Assess the idea critically, including ideas produced by [design-it-capstones](design-it-capstones.md). Do not assume that a polished proposal establishes demand or feasibility.

## Establish the evidence

Read the proposal, approved constraints, client evidence, and evaluation plan. Verify current external claims and existing alternatives with primary or official sources. Use [research-desk](research-desk.md) for source checks. Distinguish direct client evidence, broader research, team assumptions, and unverified claims.

For an approved AMAC project, assess the current scope and evidence; do not discard the client or invent a replacement project. Separate a weakness in the paper's explanation from a flaw in the system's viability.

## Stress-test the proposal

| Criterion | Evidence to seek |
| --- | --- |
| Problem and demand | A real affected user or business, recurring task, current workaround, burden, and reason to change; do not generalize a single interview into national demand |
| Usability and net convenience | An end-to-end user journey, onboarding/data-entry burden, exceptions, maintenance, and measurable benefit after those costs |
| Technical depth | A meaningful engineering problem beyond ordinary record entry, supported by an implementable system design |
| Feasibility | Team capacity, time, cost, skills, data access, hardware, network/runtime constraints, and testable integrations |
| Accessible dependencies | Required approvals, partnerships, paid APIs, private data, payments, or other external dependencies; evidence of access or a credible fallback |
| Differentiation | Existing products, research, and capstones compared on actual workflow and constraints; avoid unsupported novelty or world-first claims |
| Safety and privacy | Relevant data exposure, failure consequences, permissions, and mitigations proportional to the proposed use |
| Evaluation | Objective → measure → method/data → baseline/comparator → success criterion; distinguish proposed targets from observed results |

## Give an evidence-backed verdict

- **PASS:** Available evidence supports proceeding within the stated constraints, with ordinary limitations recorded.
- **CONDITIONAL PASS:** Proceed only if named, concrete dependencies or evidence gaps are resolved. State the conditions and how to verify them.
- **REVISE:** Material weaknesses require changes to scope, design, evidence, or evaluation before proceeding. Prioritize the smallest effective revisions.
- **REJECT:** Evidence shows a fundamental mismatch or infeasible dependency within the fixed constraints. Explain why a reasonable revision would not resolve it.

Missing evidence is uncertainty, not proof of failure or success. Explain how it affects the verdict. For comparisons, use the same criteria and make weights explicit if scoring is useful; do not manufacture numerical precision.

Return the verdict, supporting evidence, material gaps, prioritized revisions, and completion checks. Route scope redesign to [design-it-capstones](design-it-capstones.md) and authorized proposal revisions to [docs](../../documentation/references/docs.md). Revalidate changed assumptions before presenting a revised proposal as resolved.
