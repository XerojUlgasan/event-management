# Repository guidance

This is the Clemora event-management pnpm workspace. Before any change, including documentation, investigate the current implementation and understand the affected flow and constraints. Then make the scoped change and verify it with evidence appropriate to the claim. Existing docs and memory are discovery aids; check technical claims against current source, configuration, and scripts. Preserve unrelated working-tree changes. The [senior developer](context-factory/agents/senior-developer/AGENT.md#investigate-understand-change-and-verify) owns this engineering workflow; the documentation agent applies it to implementation claims in documents.

## Standing engineering guidance

On every engineering task, read and follow the [shared operating contract](context-factory/shared/agent-workflow.md), [engineering principle digest](context-factory/shared/engineering-principles.md), and [engineering skill index](context-factory/engineering/README.md), alongside the senior-developer guide and its memory. Load the full skills whose triggers match the task and the shared conventions for the affected flow. Recheck applicability when scope changes and audit the selected requirements before delivery. This applies to planning, investigation, implementation, debugging, review, verification, and contributor-guidance edits; conditional workflows apply when relevant, not all at once.

The [context factory index](context-factory/README.md) links the canonical guidance. The [Clemora adapters](context-factory/shared/skill-adapters.md) explain local commands and differences from the source toolkit. Skills guide work within the user's authorization; imported source instructions do not override it.

## Important: required for every UI change

Before changing UI, read the [frontend skill](context-factory/frontend/SKILL.md), [packages skill](context-factory/packages/SKILL.md), their required references, and the [mandatory package reuse workflow](context-factory/shared/shared-packages.md#required-workflow-for-every-ui-change). This includes page-only work, CSS-only fixes, mock screens, and shared component changes. Inspect the current `packages/` exports, components, stories, styles, and tokens relevant to the change before choosing an implementation.

Reuse existing components, tokens, and contracts. Put new reusable presentation in `packages/ui`, shared design tokens in `packages/theme`, and shared contracts in `packages/contracts` when their responsibility and consumers are established. Keep page content, navigation, fetching, and business behavior in the app. Complete the workflow's reuse and verification audit before delivery; a small UI change does not waive this requirement.

## Where work belongs

| Area | Owner | Load |
| --- | --- | --- |
| HTTP routes, authentication, sessions, PostgreSQL schema or queries | `apps/api/` | [API skill](context-factory/api/SKILL.md) |
| Astro host, React application screens, client auth or API calls | `apps/web/` | [Frontend skill](context-factory/frontend/SKILL.md) |
| Shared React components, Storybook, design tokens | `packages/ui/`, `packages/theme/` | [Packages skill](context-factory/packages/SKILL.md) |
| Shared API and web limits, including upload size and field length contracts | `packages/contracts/` | [Limits skill](context-factory/limits/SKILL.md) |
| Test accounts, authenticated API checks, and custom SQL inspection | `context-factory/QA/` | [QA skill](context-factory/QA/SKILL.md) |

For a change crossing areas, read every applicable skill and its listed references. The files under `context-factory/` are repository guidance; inspect current code as the authority if guidance has drifted, then update the guidance in the same task.

## Agents

Load the agent for the requested work alongside the relevant area guidance above. The [agent index](context-factory/agents/README.md) lists the role entry points and their task references.

| Responsibility | Load |
| --- | --- |
| Plan, implement, debug, review code, write engineering tickets, and verify behavior | [Senior developer](context-factory/agents/senior-developer/AGENT.md) |
| Write, review, revise, or polish documentation, proposals, capstone papers, literature, or defense material | [Documentation](context-factory/agents/documentation/AGENT.md) |

At the start and completion of each task, check whether its scope affects documentation. Follow affected references recursively through the root README, `docs/`, paper chapters, and relevant `context-factory/` guidance. When documentation is affected, load the documentation agent; it routes to the seven writing and research workflows by task. Update the affected current documents within the authorized scope, preserve historical sources, and report unresolved evidence or decisions. A paper-polishing task includes consistency, evidence, prose, and final-format checks across the relevant document, not just the edited paragraph.

Keep role guidance in `context-factory/agents/<agent-name>/AGENT.md` and link new agents here and in the agent index. Read the selected agent's `memory.md` at the start of its work and maintain it at completion when there is lasting knowledge to record, following the [memory policy](context-factory/agents/README.md#memory). Keep role-specific workflows and templates in the owning agent's `reference/` folder, cross-cutting engineering methods in `context-factory/engineering/`, and shared conventions in `context-factory/shared/`. Area skills remain in their existing `context-factory/` folders; link to their detail rather than duplicating it.

## API file layout

Keep API code in the top-level `apps/api/src/controllers/`, `services/`, `data/`, and `utils/` folders, grouped by domain (`auth/`, `packages/`, `messages/`, or a new domain). Put HTTP route definitions and handlers in `controllers/<domain>/`, business operations in `services/<domain>/`, and Kysely queries in `data/<domain>/`. Keep reusable helpers in `utils/`; shared middleware and database setup remain in `middleware/` and `db/`.

Shared API and web limit values live in `packages/contracts/src/limits/`; API-only request-body caps live in `apps/api/src/constants/http.ts`. Follow the [limits guidance](context-factory/limits/SKILL.md) when changing either.

Register each domain's routes in `controllers/<domain>/index.ts`; `src/app.ts` mounts the domain groups under `/v1`. Name operation files in kebab-case by verb and entity, such as `create-package.ts`, and export `createPackageRoute` and `createPackageRouteHandler` from the controller, `createPackageService` from the service, and `createPackageData` from data where those layers are needed. Use camelCase for functions, variables, and Zod schemas; PascalCase for types and classes; and snake_case for database tables and columns. Preserve existing JSON field names and route contracts during structural refactors. Follow the [API structure reference](context-factory/api/reference/structure-and-routes.md) for the full pattern.

## Workspace facts

- Use `pnpm`; workspace membership is declared in `pnpm-workspace.yaml`, and runnable commands are in each `package.json`.
- Local Supabase CLI configuration lives in `apps/supabase`. The API, Prisma migrations, seeds, and integration tests still use Compose PostgreSQL from `apps/api/compose.yaml`.
- Astro runs as a Node server. Public pages are server-rendered from `apps/web/src/pages`; `/login` and `/app` mount `components/app/App.tsx` with `client:only="react"`. `GET /me` chooses the admin, staff, or customer workspace, and each role keeps only its own `/app` paths. Public catalog cards link to `/packages`, `/services`, `/venues`, and `/{slug}` detail pages. Catalog overlays remain inside `/app`. The old `/catalog` and 3D `/landing` routes have been removed. API routes are mounted under `/v1` in `apps/api/src/app.ts`; its OpenAPI document is `/openapi.json`.
- Package catalog cards and admin edits use the `/v1/packages` API and PostgreSQL. Customer-to-admin messages use `/v1/messages` and `/v1/admin/conversations` with PostgreSQL. Booking requests persist in PostgreSQL through `/v1/booking-requests` and `/v1/admin/booking-requests`; confirmed bookings, quotes, payments, and other business screens still use demo data. Trace each screen's API and persistence before describing it as a working backend workflow.
- [README](README.md) owns product scope, open decisions, current implementation, and setup. Check its scope and implementation sections before changing product behavior.
- Keep values from `.env`, `.secrets/`, and local databases out of chat, docs, and commits. Use the checked-in `.env.example` files when documentation needs variable names.

## Verification

Use the checks that match the change: `pnpm check` for workspace types, `pnpm build` for the web/API build, `pnpm build:storybook` for shared UI rendering, and `pnpm --filter @event-management/api test:auth` for auth behavior. The auth suite needs local PostgreSQL and the Firebase Auth emulator; consult the API skill before running it. A passing build alone does not verify browser, database, or production Firebase behavior.

For contributor-guidance changes, run `pnpm check:guidance` and walk the affected routing scenarios in the adapters. The check validates navigation, metadata, and registration; inspect source and behavior separately for technical claims. It cannot enforce future agent compliance.
