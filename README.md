# Event Management monorepo

This pnpm workspace contains the Astro/React website, Hono OpenAPI backend, and shared theme and UI packages. PostgreSQL runs locally in Docker Compose. Prisma owns schema changes and migrations; Kysely handles runtime SQL and uses types generated from the database.

Product planning documents, including the current feature scope, roadmap, and reference proposal, are in [docs](docs/README.md).

## Layout

```text
apps/
  web/               Astro app hosting the migrated Clemora workspace and the /landing 3D page
  api/               Hono routes, Prisma schema, and Kysely database access
    compose.yaml     Local PostgreSQL service
packages/
  theme/             Shared design tokens and CSS variables
  ui/src/atoms/      Small reusable React components
  ui/src/molecules/  Compositions of atoms
  ui/src/organisms/  Larger shared compositions
  ui/src/templates/  Page-level shared layouts
scripts/             Local development setup for `pnpm all`
```

The root route renders the migrated Clemora frontend from `apps/web/src/components/app/`. The original Three.js landing page remains at `/landing`. Event, booking, and package screens still use local demo data. Authentication is connected to Firebase, and user profiles and roles are stored in PostgreSQL.

## Local development

Requires Node.js 22.22+, pnpm, and Docker (with Docker Compose).

```sh
pnpm install
pnpm all
```

`pnpm all` is the only command needed after installing dependencies. It:

1. creates `apps/api/.env` from `apps/api/.env.example` if it does not exist,
2. starts PostgreSQL using `apps/api/compose.yaml` and `apps/api/.env`, waiting for its healthcheck,
3. applies any pending Prisma migrations with `pnpm db:deploy`,
4. starts the API and web dev servers together with prefixed logs.

Create the web environment file before the first run:

```sh
cp apps/web/.env.example apps/web/.env
```

Fill in the Firebase web app values in `apps/web/.env` and the Firebase Admin service-account values in `apps/api/.env`. See [Authentication](#authentication).

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

Database settings live in `apps/api/.env`:

```dotenv
DB_HOST="localhost"
DB_PORT=5432
DB_NAME="event_management"
DB_USER="event_management"
DB_PASSWORD="event_management"
```

Docker Compose uses these values for PostgreSQL, and the API, Prisma, and type generator build their connection URL from the same settings. You do not need to set `DATABASE_URL`. The Compose project name stays `event_management_v2` so the existing database volume is reused.

## Authentication

Authentication uses Firebase Authentication for identity and PostgreSQL-backed sessions for API access. Customers sign up and sign in with email and password or Google. Admin accounts are never self-registered. The `users` table stores each profile and its `admin` or `customer` role; passwords are never stored in PostgreSQL.

Firebase ID tokens are only accepted by `POST /v1/auth/sync`. That route verifies the token, upserts the profile, creates a server-side session, and sets an `HttpOnly` session cookie. Every other authenticated API request uses that cookie. Sessions are stored hashed in the `sessions` table, expire after `SESSION_TTL_DAYS` (default 7), and are deleted on logout.

1. In the Firebase console, enable the **Email/Password** and **Google** sign-in providers.
2. Add `localhost` to **Authentication → Settings → Authorized domains**.
3. Copy the web app config into `apps/web/.env`:

```sh
PUBLIC_FIREBASE_API_KEY="..."
PUBLIC_FIREBASE_AUTH_DOMAIN="<project>.firebaseapp.com"
PUBLIC_FIREBASE_PROJECT_ID="<project>"
PUBLIC_FIREBASE_STORAGE_BUCKET="<project>.firebasestorage.app"
PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
PUBLIC_FIREBASE_APP_ID="..."
PUBLIC_API_URL="http://localhost:3000/v1"
```

4. Add the Admin SDK service-account values to `apps/api/.env` from **Project settings → Service accounts**:

```sh
FIREBASE_PROJECT_ID="<project>"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-...@<project>.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Alternatively, download the service-account JSON, place it at `apps/api/.secrets/firebase-service-account.json` (gitignored), and point to it:

```sh
FIREBASE_PROJECT_ID="<project>"
GOOGLE_APPLICATION_CREDENTIALS=".secrets/firebase-service-account.json"
```

Relative paths are resolved from `apps/api`, so this works regardless of where the repo lives.

The service account is required for the API to verify Firebase ID tokens. It is not used to set roles.

5. Seed an admin after the Firebase user exists (or pass `ADMIN_PASSWORD` to create it):

```sh
pnpm db:seed-admin admin@example.com
```

Roles live in the `users` table, so you can also promote or demote an account directly:

```sql
update users set role = 'admin' where email = 'admin@example.com';
update users set role = 'customer' where email = 'admin@example.com';
```

Reload the app after changing a role so the client fetches the updated profile. The seed script is only a convenience.

### Session API

The auth API routes are:

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /v1/auth/sync` | `Authorization: Bearer <Firebase ID token>` | Verify identity, upsert the profile, start a session |
| `GET /v1/me` | `em_session` cookie | Return the current profile |
| `POST /v1/auth/logout` | `em_session` cookie | Delete the session and clear the cookie |

Optional config in `apps/api/.env`:

```sh
SESSION_TTL_DAYS=7
```

With curl:

```sh
# Exchange a Firebase ID token for a session cookie
curl -c cookies.txt -X POST http://localhost:3000/v1/auth/sync \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" -d '{}'

curl -b cookies.txt http://localhost:3000/v1/me
curl -b cookies.txt -X POST http://localhost:3000/v1/auth/logout
```

The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when `NODE_ENV=production`. The client can never set its own role.

## Database workflow

Add models to `apps/api/prisma/schema.prisma`, then run:

```sh
pnpm db:migrate
pnpm db:generate
pnpm check
```

`db:migrate` creates and applies a development migration. Use `pnpm db:deploy` to apply committed migrations in a deployed environment. Never edit `apps/api/src/db/types.ts` by hand; it is generated from the migrated database. The `users` migration creates the profile and role table used by authentication.

### Inspecting data with DBeaver

PostgreSQL runs in Docker and is published on `127.0.0.1:5432`. Start it with `pnpm db:up` (or `pnpm all`), then create a DBeaver connection:

| Setting | Value |
| --- | --- |
| Driver | PostgreSQL |
| Host | `localhost` |
| Port | `5432` |
| Database | `event_management` |
| Username | `event_management` |
| Password | `event_management` |
| SSL | Off (local) |

These are the local defaults from `apps/api/.env.example`; configure them in `apps/api/.env`. If DBeaver runs on the same machine as Docker, no extra setup is needed. If DBeaver itself runs in a container, use `host.docker.internal` instead of `localhost`.

Useful queries:

```sql
select id, email, display_name, role, created_at
from users
order by created_at;

select id, user_id, expires_at, created_at
from sessions
order by created_at desc;

update users set role = 'admin' where email = 'admin@example.com';
```

Reload the app after changing a role; the client caches the profile until the next page load or sign-in.

## API routes and shared UI

For a new API feature, define a Zod schema and `createRoute` with its typed handler in `apps/api/src/routes/<feature>/`, assemble routes with `OpenAPIHono`, and mount them in `apps/api/src/app.ts`. The health route is the working example.

Theme tokens live in `packages/theme/src/theme.css`. Reusable React components and their styles live in `packages/ui`; the shared library includes the wordmark, buttons, badges, icons, stat cards, links, navigation, section counter, and inclusion strip. The migrated workspace composes those primitives, while its page layouts and the procedural 3D event models live in `apps/web/src`. The landing at `/landing` remains informational: inquiry, quote, booking, and add-on selection flows are later work.
