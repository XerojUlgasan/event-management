# Repository guidance

This is the Clemora event-management pnpm workspace. Inspect the files involved in a task before changing them, follow the current pattern, keep edits scoped, and run the closest relevant check. Preserve unrelated working-tree changes.

## Where work belongs

| Area | Owner | Load |
| --- | --- | --- |
| HTTP routes, authentication, sessions, PostgreSQL schema or queries | `apps/api/` | [API skill](context-factory/api/SKILL.md) |
| Astro pages, React application screens, client auth or API calls | `apps/web/` | [Frontend skill](context-factory/frontend/SKILL.md) |
| Shared React components, Storybook, design tokens | `packages/ui/`, `packages/theme/` | [Packages skill](context-factory/packages/SKILL.md) |
| Test accounts, authenticated API checks, and custom SQL inspection | `context-factory/QA/` | [QA skill](context-factory/QA/SKILL.md) |

For a change crossing areas, read every applicable skill and its listed references. The files under `context-factory/` are repository guidance; inspect current code as the authority if guidance has drifted, then update the guidance in the same task.

## Workspace facts

- Use `pnpm`; workspace membership is declared in `pnpm-workspace.yaml`, and runnable commands are in each `package.json`.
- `/` is `apps/web/src/pages/index.astro` and hosts the React Clemora app. `/landing` is `apps/web/src/pages/landing.astro`. API routes are mounted under `/v1` in `apps/api/src/app.ts`; its OpenAPI document is `/openapi.json`.
- Package catalog cards and admin edits use the `/v1/packages` API and PostgreSQL. Bookings, quotes, payments, and other business screens still use demo data. Trace each screen's API and persistence before describing it as a working backend workflow.
- [Product scope](docs/FEATURES.md) describes the intended business workflow; [README](README.md) describes current setup and implemented behavior. Check both when implementing product behavior.
- Keep values from `.env`, `.secrets/`, and local databases out of chat, docs, and commits. Use the checked-in `.env.example` files when documentation needs variable names.

## Verification

Use the checks that match the change: `pnpm check` for workspace types, `pnpm build` for the web/API build, `pnpm build:storybook` for shared UI rendering, and `pnpm --filter @event-management/api test:auth` for auth behavior. The auth suite needs local PostgreSQL and the Firebase Auth emulator; consult the API skill before running it. A passing build alone does not verify browser, database, or production Firebase behavior.
