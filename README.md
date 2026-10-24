# Event Management monorepo

This pnpm workspace contains the Astro/React website, Hono OpenAPI backend, and shared theme and UI packages. PostgreSQL runs locally in Docker Compose. Prisma owns schema changes and migrations; Kysely handles runtime SQL and uses types generated from the database.

Product planning documents, including the current feature scope, roadmap, and reference proposal, are in [docs](docs/README.md).

## Layout

```text
apps/
  web/               Astro app hosting the migrated Clemora workspace and the /landing 3D page
  api/               Hono routes, Prisma schema, and Kysely database access
packages/
  theme/             Shared design tokens and CSS variables
  ui/src/atoms/      Small reusable React components
  ui/src/molecules/  Compositions of atoms
  ui/src/organisms/  Larger shared compositions
  ui/src/templates/  Page-level shared layouts
scripts/             Local development setup for `pnpm all`
compose.yaml         Local PostgreSQL service
```

The root route renders the migrated Clemora frontend from `apps/web/src/components/app/`. The original Three.js landing page remains at `/landing`. The app screens use local demo data and are not connected to the API or database.

## Local development

Requires Node.js 22.22+, pnpm, and Docker (with Docker Compose).

```sh
pnpm install
pnpm all
```

`pnpm all` is the only command needed after installing dependencies. It:

1. creates `apps/api/.env` from `apps/api/.env.example` if it does not exist,
2. starts PostgreSQL with `docker compose up -d --wait db`,
3. applies any pending Prisma migrations with `pnpm db:deploy`,
4. starts the API and web dev servers together with prefixed logs.

The workspace is at `http://localhost:4321`, the landing page is at `http://localhost:4321/landing`, the API health route is at `http://localhost:3000/v1/health`, and the OpenAPI document is at `http://localhost:3000/openapi.json`.

Press `Ctrl+C` to stop the API and web servers. PostgreSQL keeps running so restarts are fast; stop it with `pnpm db:down`.

Useful variants:

| Command | What it runs |
| --- | --- |
| `pnpm all` (or `pnpm dev`) | PostgreSQL, migrations, API, and web |
| `pnpm all:storybook` | The above plus Storybook at `http://localhost:6006` |
| `pnpm all:web` | Web only (no Docker, API, or database) |
| `pnpm dev:prepare` | Database setup and migrations only |

The frontend uses the shared component library from `@event-management/ui`, organized into `atoms/`, `molecules/`, `organisms/`, and `templates/`. Shared component styles live in `packages/ui/src/styles.css`; app-specific overrides are in `apps/web/src/styles/app.css`. Migrated screens live in `apps/web/src/components/app`, with page components in `app/pages` and the customer portal in `app/customer`. Fonts and images are vendored in `apps/web/public/fonts` and `apps/web/public/images`, so the app does not depend on external asset requests.

To browse the shared UI components, run `pnpm all:storybook` for the full stack plus Storybook, or `pnpm storybook` (also `pnpm sstorybook`) on its own, then open `http://localhost:6006`. Story files live beside components in `packages/ui/src`. Run `pnpm build:storybook` to verify the static Storybook build.

`pnpm db:down` stops PostgreSQL but retains its named volume. The Compose username and password are local development defaults; use separate credentials outside local development.

## Database workflow

Add models to `apps/api/prisma/schema.prisma`, then run:

```sh
pnpm db:migrate
pnpm db:generate
pnpm check
```

`db:migrate` creates and applies a development migration. Use `pnpm db:deploy` to apply committed migrations in a deployed environment. Never edit `apps/api/src/db/types.ts` by hand; it is generated from the migrated database. The initial schema intentionally has no domain models or migration because the event data model has not been specified.

## API routes and shared UI

For a new API feature, define a Zod schema and `createRoute` with its typed handler in `apps/api/src/routes/<feature>/`, assemble routes with `OpenAPIHono`, and mount them in `apps/api/src/app.ts`. The health route is the working example.

Theme tokens live in `packages/theme/src/theme.css`. Reusable React components and their styles live in `packages/ui`; the shared library includes the wordmark, buttons, badges, icons, stat cards, links, navigation, section counter, and inclusion strip. The migrated workspace composes those primitives, while its page layouts and the procedural 3D event models live in `apps/web/src`. The landing at `/landing` remains informational: inquiry, quote, booking, and add-on selection flows are later work.
