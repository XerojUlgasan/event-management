# Review checks and severity

Use with the [review workflow](../SKILL.md). Establish expectations from approved requirements and current contracts; existing behavior alone does not prove the intended rule. Keep missing product decisions separate from defects.

## Follow the reachable failure

Trace the relevant path from user input through client state, API validation/authorization, service decisions, query/transaction, response, and visible/persisted result. Prioritize:

- Permissions, ownership, cross-account exposure, and server enforcement behind visible controls.
- Validation, calculations, units, defaults, and state transitions under established policy.
- API/browser/shared-contract mismatches, Prisma migrations, and generated Kysely shapes.
- Partial/lost writes, stale updates, duplicates, archive visibility, and failure recovery.
- Inquiry snapshots, historical records, catalog/media cleanup, and downstream consumers.
- Concrete empty, invalid, unavailable, accessibility, and error states in the affected journey.

A demo, enum, type check, or passing build does not establish a persisted workflow. Reject preferences and hypothetical cases prevented by a real boundary. Use the smallest authorized check that can confirm the suspected failure; inspect setup and retain its evidence limits.

## Impact scale

| Priority | Confirmed impact |
| --- | --- |
| P0 | Active compromise, catastrophic data loss, or systemic outage |
| P1 | Serious authorization, privacy, integrity, migration, or release-breaking defect |
| P2 | Material functional, accessibility, performance, or reliability defect |
| P3 | Concrete localized defect with limited impact |

## Finding format

State a short title/priority, responsible file and line, reachable trigger, expected rule and source, observed behavior, consequence, supporting evidence, and material uncertainty. For diffs, cite the responsible changed line; an unchanged consumer can demonstrate impact. Explain the flow plainly and keep questions separate. If no finding qualifies, report that with examined scope and remaining verification limits.
