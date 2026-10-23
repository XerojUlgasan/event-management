# Event Management monorepo

This pnpm workspace contains the Astro/React website, Hono OpenAPI backend, and shared theme and UI packages. PostgreSQL runs locally in Docker Compose. Prisma owns schema changes and migrations; Kysely handles runtime SQL and uses types generated from the database.

Product planning documents, including the current feature scope, roadmap, and reference proposal, are in [docs](docs/README.md).

## Layout

```text
apps/
  web/               Astro landing page with an interactive Three.js scene
  api/               Hono routes, Prisma schema, and Kysely database access
packages/
  theme/             Shared design tokens and CSS variables
  ui/src/atoms/      Small reusable React components
  ui/src/molecules/  Compositions of atoms
  ui/src/organisms/  Larger shared compositions when needed
compose.yaml         Local PostgreSQL service
```

The original `Clemora Catering Management System/` folder remains untouched as a reference. The previous React prototype remains in `apps/web/src/components/ClemoraApp.tsx`, but the root route now renders the new landing page. The prototype's demo accounts and sample screens are not connected to the API or database.

## Local development

Requires Node.js, pnpm, and Docker Compose.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm db:validate
pnpm db:generate
pnpm db:check
pnpm dev:api
pnpm dev:web
```

Run the last two commands in separate terminals. The site is at `http://localhost:4321`, the API health route is at `http://localhost:3000/v1/health`, and its OpenAPI document is at `http://localhost:3000/openapi.json`.

To browse the shared UI components, run `pnpm storybook` (or `pnpm sstorybook`) and open `http://localhost:6006`. Story files live beside components in `packages/ui/src`. Run `pnpm build:storybook` to verify the static Storybook build.

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

Theme tokens live in `packages/theme/src/theme.css`. Reusable React components and their styles live in `packages/ui`; the landing page uses its shared wordmark, links, navigation, section counter, and inclusion strip. Its page layout and procedural 3D event models live in `apps/web/src`. The landing is informational: inquiry, quote, booking, and add-on selection flows are later work.
