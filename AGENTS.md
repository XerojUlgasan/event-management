# Repository guidance

This is the Clemora event-management pnpm workspace. Inspect the files involved in a task before changing them, follow the current pattern, keep edits scoped, and run the closest relevant check. Preserve unrelated working-tree changes.

## Where work belongs

| Area | Owner | Load |
| --- | --- | --- |
| HTTP routes, authentication, sessions, PostgreSQL schema or queries | `apps/api/` | [API skill](context-factory/api/SKILL.md) |
| Astro pages, React application screens, client auth or API calls | `apps/web/` | [Frontend skill](context-factory/frontend/SKILL.md) |
| Shared React components, Storybook, design tokens | `packages/ui/`, `packages/theme/` | [Packages skill](context-factory/packages/SKILL.md) |
| Shared API and web limits, including upload size and field length contracts | `packages/contracts/` | [Limits skill](context-factory/limits/SKILL.md) |
| Test accounts, authenticated API checks, and custom SQL inspection | `context-factory/QA/` | [QA skill](context-factory/QA/SKILL.md) |

For a change crossing areas, read every applicable skill and its listed references. The files under `context-factory/` are repository guidance; inspect current code as the authority if guidance has drifted, then update the guidance in the same task.

## Task skills

Load the skill for the requested task alongside the relevant area guidance above.

| Task | Load |
| --- | --- |
| Review code, a diff, or a pull request for behavior and regressions | [Code review](context-factory/skills/code-review/SKILL.md) |
| Create or rewrite implementation, bug, spike, or Epic tickets | [Ticket writing](context-factory/skills/ticket-writing/SKILL.md) |

Keep reusable task skills in `context-factory/skills/<skill-name>/SKILL.md` and link new entries here. Put detailed templates or conditional guidance in the skill's `reference/` folder when needed.

## API file layout

Keep API code in the top-level `apps/api/src/controllers/`, `services/`, `data/`, and `utils/` folders, grouped by domain (`auth/`, `packages/`, `messages/`, or a new domain). Put HTTP route definitions and handlers in `controllers/<domain>/`, business operations in `services/<domain>/`, and Kysely queries in `data/<domain>/`. Keep reusable helpers in `utils/`; shared middleware and database setup remain in `middleware/` and `db/`.

Shared API and web limit values live in `packages/contracts/src/limits/`; API-only request-body caps live in `apps/api/src/constants/http.ts`. Follow the [limits guidance](context-factory/limits/SKILL.md) when changing either.

Register each domain's routes in `controllers/<domain>/index.ts`; `src/app.ts` mounts the domain groups under `/v1`. Name operation files in kebab-case by verb and entity, such as `create-package.ts`, and export `createPackageRoute` and `createPackageRouteHandler` from the controller, `createPackageService` from the service, and `createPackageData` from data where those layers are needed. Use camelCase for functions, variables, and Zod schemas; PascalCase for types and classes; and snake_case for database tables and columns. Preserve existing JSON field names and route contracts during structural refactors. Follow the [API structure reference](context-factory/api/reference/structure-and-routes.md) for the full pattern.

## Workspace facts

- Use `pnpm`; workspace membership is declared in `pnpm-workspace.yaml`, and runnable commands are in each `package.json`.
- `/` is `apps/web/src/pages/index.astro` and hosts the React Clemora app. Public catalog sections and their View more overlays live there; the old `/catalog` and 3D `/landing` routes have been removed. API routes are mounted under `/v1` in `apps/api/src/app.ts`; its OpenAPI document is `/openapi.json`.
- Package catalog cards and admin edits use the `/v1/packages` API and PostgreSQL. Customer-to-admin messages use `/v1/messages` and `/v1/admin/conversations` with PostgreSQL. Booking requests persist in PostgreSQL through `/v1/booking-requests` and `/v1/admin/booking-requests`; confirmed bookings, quotes, payments, and other business screens still use demo data. Trace each screen's API and persistence before describing it as a working backend workflow.
- [Product scope](docs/FEATURES.md) describes the intended business workflow; [README](README.md) describes current setup and implemented behavior. Check both when implementing product behavior.
- Keep values from `.env`, `.secrets/`, and local databases out of chat, docs, and commits. Use the checked-in `.env.example` files when documentation needs variable names.

## Verification

Use the checks that match the change: `pnpm check` for workspace types, `pnpm build` for the web/API build, `pnpm build:storybook` for shared UI rendering, and `pnpm --filter @event-management/api test:auth` for auth behavior. The auth suite needs local PostgreSQL and the Firebase Auth emulator; consult the API skill before running it. A passing build alone does not verify browser, database, or production Firebase behavior.
