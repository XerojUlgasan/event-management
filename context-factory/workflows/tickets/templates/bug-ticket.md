# Bug ticket

Describe observed behavior separately from expected behavior. State a root cause only when evidence confirms it.

Use the smallest reliable reproduction. If the issue is intermittent or cannot be reproduced, say so. Record the known frequency and available evidence. Identify a regression or last working version only when verified.

Keep unrelated improvements outside the fix scope. Make material user or business risks visible without overstating certainty.

```markdown
# [Area] [Concise description of incorrect behavior]

## Context

[Who is affected, why it matters, and the expected product invariant.]

- **Impact:** [User or business consequence.]
- **Frequency:** [Always, observed intermittent rate, or unknown.]
- **Regression:** [Yes, no, or unknown. Include the last working version if verified.]

## Observed behavior

[Exact visible result or system response.]

## Expected behavior

[Required behavior. Link the approved requirement or established behavior when available.]

## Reproduction

### Preconditions and environment

- User or role: [Relevant role.]
- Application, screen, or version: [Relevant environment.]
- Browser or device: [When relevant.]
- Required record or state: [Necessary starting conditions.]

### Steps

1. [Action.]
2. [Action.]
3. [Observe the failure.]

### Evidence

- [Sanitized screenshot, recording, log, trace, error message, or relevant identifier.]

## Business rule or invariant

- **BR-01:** [Rule the current behavior violates.]
- **BR-02:** [Relevant validation, state, or edge-case behavior.]

## Scope

### Included

- [Behavior and affected area to restore.]
- [Required regression coverage or data correction, when applicable.]

### Not included

- [Adjacent behavior or unrelated improvement.]

## Permission rules

[Relevant role, ownership, visibility, or authorization conditions. If none change, state that existing permissions remain unchanged.]

## Acceptance criteria

- [ ] **AC-01:** Given the reproduction conditions, when [action], then [expected behavior] occurs.
- [ ] **AC-02:** The behavior conforms to BR-XX for [important condition].
- [ ] **AC-03:** [Relevant error, empty, permission, or boundary case] behaves as specified.
- [ ] **AC-04:** [Specific related behavior that must remain stable] continues to work.
```
