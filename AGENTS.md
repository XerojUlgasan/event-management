# Repository guidance

Clemora is a pnpm event-management workspace. Start with the [task router](context-factory/README.md); read the selected role, affected areas, workflow, and references whose conditions match the task. Re-evaluate when scope changes. Guidance is readable directly; automatic skill discovery is optional.

## Standing rules

1. Establish the requested outcome and authorization. Planning, investigation, and review stay read-only unless changes are authorized. Continue routine authorized work; ask about missing business decisions that affect correctness.
2. Inspect the branch, revision, working-tree changes, relevant source, callers, configuration, contracts, and tests before changing anything, including documentation. Preserve unrelated work. Docs and previous runs locate evidence; verify their claims against the current artifact.
3. Understand ownership and constraints, make the scoped change, then verify it with a check that could expose the relevant mistake. Keep contracts and callers coherent. Use `pnpm` and inspect actual package scripts before running commands.
4. Check documentation impact at startup and completion. Follow affected links and incoming mentions; update current documents within scope and preserve historical sources. Use [product scope and implementation](context-factory/business/product.md) for scope, open decisions, and feature status. Use [development setup and verification](context-factory/workflows/implement/references/development.md) for local commands and configuration. Intended business rules, source behavior, and observed test results are different evidence.
5. Keep credentials, runtime tokens, private fixture data, and values from `.env`, `.secrets/`, or databases out of chat and committed artifacts. Use `.env.example` for documented variable names. Shared data, migrations, resets, and running services require the task's authorization; inspect test side effects first.
6. Delegate only when requested by the user or applicable guidance. Bound helpers' paths, side effects, and evidence; isolate writers and serialize shared Git/browser operations. The lead inspects and integrates results. Self-review is not independent review.
7. Before delivery, audit the requested outcome, selected guidance, final diff, and evidence. Distinguish source, types, tests, API, database, browser, and provider proof. Report skipped checks and remaining limits.

## Required routes

- **Every UI change**, including CSS, page-only, and mock work: read [frontend](context-factory/areas/frontend/SKILL.md), [packages](context-factory/areas/packages/SKILL.md), and their mandatory structure/reuse references. Inspect relevant current exports, components, stories, styles, tokens, and contracts before choosing an implementation; complete the reuse audit.
- **Roles, permissions, or product behavior:** read the matching [business rules](context-factory/business/README.md) and verify implemented permissions separately. An inquiry is not a reservation or confirmed booking. Payment, inventory, and supplier management remain outside approved scope.
- **Continuation or multi-session work:** use [runs](context-factory/runs/README.md). Read the newest relevant run for the topic and checkout, confirm current state, and preserve unfinished work and authorization limits.
- **Contributor-guidance edits:** follow the [documentation workflow](context-factory/workflows/documentation/SKILL.md), run `pnpm check:guidance` and `pnpm test:guidance`, and walk the [routing scenarios](context-factory/routing-checks.md). Checks establish navigation and routing structure, not future agent compliance.
