# Implementation ticket

Use every section below in this order. Aim for three to seven deliverables when practical.

Define the applicable eligibility, exclusions, validation, defaults, limits, precedence, and state transitions. Cover relevant empty, invalid, unavailable, duplicate, stale, and failure states.

For calculations, state the formula, inputs, units, rounding, and thresholds. Include a worked example when interpretation could differ. Use a decision table when branching rules are easier to compare.

Permission rules must distinguish viewing from acting. Cover applicable roles, ownership, organization boundaries, entitlements, record states, and denied-access behavior.

```markdown
# [Clear, outcome-oriented title]

## Context

[Current problem, affected users, why it matters, and desired outcome.]

## Deliverables

- [Concrete product or system capability.]
- [Visible or measurable result.]

## Business rules

- **BR-01:** [Deterministic rule.]
- **BR-02:** When [condition], [expected behavior].
- **BR-03:** [Applicable validation, default, limit, or precedence rule.]

## Scope

### Included

- [Included behavior, user, journey, or case.]

### Not included

- [Likely misunderstanding, adjacent request, or intentionally deferred behavior.]

## Permission rules

| Role or condition | View | Create | Update | Delete or other action |
|---|---|---|---|---|
| [Role or condition] | [Allowed?] | [Allowed?] | [Allowed?] | [Allowed?] |

- **PR-01:** [Ownership, visibility, entitlement, or authorization rule.]
- **PR-02:** When access is denied, [expected user and system behavior].

## Acceptance criteria

- [ ] **AC-01:** Given [starting condition], when [action], then [observable result].
- [ ] **AC-02:** Given [rule condition], when [event], then [result defined by BR-XX].
- [ ] **AC-03:** A user without [required permission] cannot [restricted action or visibility].
- [ ] **AC-04:** [Relevant validation or edge state] behaves as defined in BR-XX.
```

If permissions are unaffected, replace the permission table and rules with:

> Existing permissions remain unchanged. No new role, ownership, or visibility rules are introduced.
