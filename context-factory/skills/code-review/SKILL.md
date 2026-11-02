---
name: code-review
description: Review Clemora code, diffs, or pull requests for business-logic errors, permission gaps, contract mismatches, and regressions. Use for review or audit requests; implementation alone does not require this workflow.
---

# Code review

Review the requested scope. Edit code only when the user also asks for fixes. Load the relevant area skills from [repository guidance](../../../AGENTS.md); keep the review grounded in the current repository.

## Establish scope and expected behavior

- Resolve the requested files, diff, branch, or pull request and its comparison baseline before reviewing. For changes, inspect the full diff and the surrounding callers and consumers needed to understand the behavior. State the scope and baseline in the result.
- Establish intended behavior from the user's request, approved requirements, contracts, and tests. Read the [README](../../../README.md) for current implementation and [product scope](../../../docs/FEATURES.md) for the intended workflow and open business decisions. Existing behavior alone does not establish that a rule is correct.
- Separate demonstrated defects from missing product decisions. When a rule is uncertain, state the uncertainty or ask a focused question instead of inventing the expected result.

## Trace the affected flow

Follow the relevant path from user input through client state, API validation and authorization, service decisions, database changes, response, and the user-visible result. Follow shared contracts and downstream consumers when a changed field or operation crosses boundaries.

Prioritize reachable problems with a concrete consequence:

- Wrong permissions, ownership checks, or exposure of another user's records. Check server enforcement as well as visible controls.
- Incorrect validation, calculations, units, defaults, or state transitions. Use approved pricing and reservation terms; unresolved policies are questions.
- Contract mismatches between API, browser, shared limits, Prisma migrations, and generated Kysely types when those areas are affected.
- Lost or partial writes, stale updates, duplicate submissions, and archive behavior that can break the affected journey.
- Regressions in snapshots, historical records, and existing callers when catalog or schema behavior changes.
- Plausible empty, invalid, unavailable, and failure states along the affected path.

Inspect each screen's actual API and persistence before claiming a backend workflow works. Demo data, planned features, and enum values do not prove implemented behavior. Skip style preferences and speculative scenarios without a supported failure path.

## Verify findings

Use the smallest relevant check that can confirm the suspected failure. Follow area guidance for available tests and the [QA skill](../../QA/SKILL.md) for authenticated API, browser, or database checks. Preserve unrelated working-tree changes and shared data.

Distinguish source inspection, test results, API responses, database evidence, browser observations, and external-provider behavior. Say which checks ran and which were unavailable. A passing build alone does not prove the user journey, database behavior, or production integrations.

## Report findings

Put actionable findings first, ordered by practical impact. For each supported finding, provide:

- A short title and concrete user or business impact; use the project's severity scale if one exists.
- A precise file and line reference to the responsible code, within the changed lines when reviewing a diff.
- The reachable starting conditions and action that cause the failure.
- Why it happens, what currently happens, and the expected result under the established rule, with the rule's source.
- The supporting check or source evidence and any material uncertainty.

Explain the flow in plain language. Keep implementation suggestions within the user's requested scope. If no actionable finding is supported, say so and give the review scope and meaningful verification limits; do not manufacture a defect from an unresolved requirement.
