# Spike ticket

Frame a spike around a decision or specific unknown. Explain why existing information is insufficient and what work the uncertainty blocks.

Define the timebox, required evidence, and stop conditions before investigation begins. If the timebox is missing, request it or label a proposed timebox for agreement. Separate required investigation from optional exploration.

Choose the least expensive investigation that can support the decision. Examples include reading existing code, tracing a flow, checking a provider constraint, comparing options, or running a narrow experiment.

Keep production implementation outside the spike. Any production experiment needs explicit authorization and stated boundaries. Treat prototypes as disposable unless separately reviewed and approved for production use.

```markdown
# Investigate [unknown] to decide [decision]

## Context

[Uncertainty, why it matters, work it blocks, what is already known, and why that information is insufficient.]

## Objective

By the end of this spike, the team can decide:

- [Specific decision the investigation must enable.]

## Questions to answer

1. [Material unknown.]
2. [Material unknown.]
3. [Constraint, feasibility, risk, or tradeoff question.]

## Scope

### Included

- [Systems, options, evidence, or experiments to investigate.]

### Not included

- Production implementation.
- [Unrelated options or downstream work.]

## Investigation approach

- Review [relevant source, system, or existing behavior].
- Compare [options against the decision's constraints].
- Run [safe proof of concept, benchmark, or experiment], if needed.
- Gather [required evidence]. Mark optional exploration separately.

## Deliverables

- Findings with supporting evidence.
- A recommendation and its tradeoffs.
- Risks, constraints, assumptions, and remaining unknowns.
- Follow-up implementation or discovery tickets, when warranted.

## Timebox and stop conditions

- **Timebox:** [Agreed hours or working days.]
- Stop early when [the decision has sufficient evidence].
- At the timebox, document remaining uncertainty instead of extending silently.

## Constraints and permissions

- [Data access, privacy, security, environment, cost, or authorization boundaries.]
- [Whether production data access or production changes are prohibited or explicitly authorized.]

## Acceptance criteria

- [ ] **AC-01:** Each required question is answered or marked unresolved with the reason.
- [ ] **AC-02:** Findings cite reproducible evidence, measurements, or authoritative sources.
- [ ] **AC-03:** The recommendation compares material tradeoffs and explains the preferred outcome.
- [ ] **AC-04:** Risks, constraints, assumptions, and remaining unknowns are recorded.
- [ ] **AC-05:** Follow-up work is identified without implementing it inside the spike.
```

Close the spike at the end of its timebox even if uncertainty remains. Recommend one of these outcomes:

- Proceed with a specific approach.
- Run a narrower follow-up investigation.
- Defer because the value does not justify the cost or risk.
- Stop because the approach is not feasible under current constraints.
