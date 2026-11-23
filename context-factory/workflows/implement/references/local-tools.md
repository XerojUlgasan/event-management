# Local commands and targets

Read when choosing commands or interpreting local runtime evidence. Inspect current [root](../../../../package.json), [API](../../../../apps/api/package.json), and [web](../../../../apps/web/package.json) scripts before execution.

For an isolated test environment, follow [test worktrees in .room](worktrees.md). `pnpm room create <name> [revision]` and `pnpm room start <name>` prepare dependencies, deploy migrations, seed, and start the room's own services before reporting readiness.

| Need | Starting point / boundary |
| --- | --- |
| Inspect rooms | `pnpm room status <name>` or `pnpm room list`; shows runtime state, paths, and assigned URLs |
| Stop a room | `pnpm room stop <name>`; stops its services and keeps its worktree, database, and Storage data |
| Remove a room checkout | Follow [stop and remove](worktrees.md#stop-and-remove): save needed work, stop the room, then `git worktree remove .room/<name>`; unregisters/deletes the checkout while retaining runtime state and data volumes |
| Types | `pnpm check`; includes web structure and package checks, not browser proof |
| API/web bundles | `pnpm build`; provider/database behavior needs separate evidence |
| Shared UI rendering | `pnpm build:storybook`, then inspect affected stories/consumers |
| Guidance | `pnpm check:guidance` and `pnpm test:guidance`; walk [routing scenarios](../../../routing-checks.md) |
| Web placement/import boundaries | `pnpm check:web-structure`; does not prove semantic ownership or runtime behavior |
| API behavior | Focused `test:*` in API scripts; read [setup](../../../areas/api/references/verification.md) first |
| Sessions and SQL | [QA](../../qa/SKILL.md); helpers are under `context-factory/tools/qa/` |
| Database schema/types | Prisma migrations own schema; Kysely owns runtime queries/generated types; follow [database guidance](../../../areas/api/references/database-and-migrations.md) |

`pnpm all` runs preparation that applies migrations. Do not start it for a read-only review or document check. Never reset a database to conceal drift. Confirm the actual process, checkout, API target, database, and migration state before interpreting results.

Local Supabase configuration is under `apps/supabase`; Compose PostgreSQL remains the API migration/seed/integration-test target. The README's [local development](../../../../README.md#local-development) owns current setup. A healthy shell, Studio page, or listening port does not prove the intended target is active.

Discover available browser, connector, CLI, and model capabilities rather than assuming imported tooling exists. Use the inherited model unless instructed otherwise. Resolve the actual requested/default Git base; new agent branches use `codex/` unless the user specifies otherwise. Delegation and external actions follow root authorization rules.
