# Organize guidance by responsibility and task

Date: 2026-11-14
Status: accepted
Authority: User approved the proposed structure, record formats, and implementation in this chat.
Implementation: Implemented; see [verification](../verification/2026-11-14_11-05-48_guidance-reorganization.md) and the [run](../../runs/2026-11-14_10-59-01_context-factory-reorganization.md).

## Problem

Repeated startup instructions, unconditional reference lists, dense implementation digests, and dated role memories made guidance difficult for people and agents to navigate.

## Decision

Keep standing rules in root AGENTS.md and use one task router. Separate roles, implementation areas, business rules, task workflows, executable helpers, historical decisions/verification, and continuation runs. Load references under explicit task conditions. Preserve mandatory UI reuse, source investigation, scoped authorization, and evidence boundaries.

## Alternatives considered

- Keep the old paths and shorten prose: lower migration cost, but preserves overlapping ownership and navigation.
- Retain every imported skill as a separate entry: preserves import parity, but keeps unnecessary selection overhead.

## Rationale

A reader can choose by responsibility, affected area, and task. Current rules have one owner; historical records retain rationale/evidence without becoming startup requirements.

## Consequences

Move links and helpers together; update registration and routing checks. Consolidate short generic principles into practical workflows. Research/defense loads for those tasks; all UI edits still load frontend, packages, structure, and reuse. Recheck old run claims against the actual checkout. No application or business behavior changes are authorized by this reorganization.

## References

- [Standing rules](../../../AGENTS.md)
- [Task router](../../README.md)
- [Routing scenarios](../../routing-checks.md)
