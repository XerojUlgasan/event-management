# Event Management monorepo

This pnpm workspace contains the Astro/React website, Hono OpenAPI backend, and shared theme and UI packages. PostgreSQL runs locally in Docker Compose. Prisma owns schema changes and migrations; Kysely handles runtime SQL and uses types generated from the database.

Product planning documents, including the current feature scope, roadmap, and reference proposal, are in [docs](docs/README.md).

## Layout

```text
apps/
  web/               Astro app hosting the Clemora workspace and public catalog
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

The root route renders the Clemora frontend from `apps/web/src/components/app/`. It features packages, services, and venues in that order; each View more control opens the full catalog in an overlay. The package catalog reads and edits PostgreSQL records through the API; `db:seed` adds clearly labeled published demo offers, not business-approved packages. Customer-to-admin messages and booking requests persist in PostgreSQL and are shared by the customer and admin workspaces. A booking request asks for a preferred date, guest estimate, approximate event length, event type, and contact phone; exact hours and venue are gathered later. Booking requests are inquiries for staff review; they do not reserve dates, approve final prices, or confirm bookings. Quote, payment, and other event-delivery screens remain demo or future work. Authentication supports local email/password accounts and Firebase sign-in, with shared profiles, roles, and sessions in PostgreSQL.

The package catalog supports private admin drafts, versioned publication, archiving, and deletion of never-published unreferenced drafts. Admins use a three-step editor with removable tags for event types, inclusions, and exclusions, plus an HTTPS image URL. Each package's inclusions are entered explicitly. Public and customer views show only current published packages. Package prices are fixed totals in PHP, stored as centavos. Admins can also publish versioned services with category tags and an HTTPS image URL, then assign them to packages as included benefits or optional paid add-ons. Add-on prices are fixed PHP amounts per unit for each package assignment. Apply catalog migrations with `pnpm db:deploy` on an existing local database; `pnpm --filter @event-management/api test:packages` runs catalog behavior tests against a disposable local database. See the [package](docs/PACKAGES_CRUD_DRAFT.md) and [service](docs/SERVICES.md) catalog notes for the contracts.

Package and service versions keep optional HTTPS image URLs. Venue versions keep up to 10 ordered HTTPS photo URLs. The API no longer uploads or serves image files. The [image cleanup migration](context-factory/api/reference/external-image-urls.md) stops if uploaded image records still exist; replace those references before applying it.

Venues have a standalone, versioned admin catalog and a public Venues section on `/`. Admins create drafts, publish them, and archive venues. Each venue has a title, location, description, optional category tags, minimum and maximum capacity, and up to 10 external HTTPS photo URLs. Publishing a new venue requires both positive capacity values; photos are optional. Existing active venues migrate as visible published entries even when capacity and photos are absent; archived venues remain hidden. Published venues appear on `/` after packages and services, with detail previews and a View more overlay. Venues do not belong to packages. Package venue details are omitted from APIs and screens while historical values remain in the legacy database field; booking requests keep their independent preferred-location field. Google Maps pinning is deferred until a Maps API key is available.

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

Local email/password sign-in works without Firebase credentials. To enable Google and existing Firebase email/password sign-in, fill in the Firebase web app values in `apps/web/.env` and the Firebase Admin service-account values in `apps/api/.env`. See [Authentication](#authentication).

The workspace and public site are at `http://localhost:4321/`. The public site previews published packages, services, and venues; View more opens the relevant catalog overlay. The API health route is at `http://localhost:3000/v1/health`, and the OpenAPI document is at `http://localhost:3000/openapi.json`.

Press `Ctrl+C` to stop the API and web servers. PostgreSQL keeps running so restarts are fast; stop it with `pnpm db:down`.

Useful variants:

| Command | What it runs |
| --- | --- |
| `pnpm all` (or `pnpm dev`) | PostgreSQL, migrations, API, and web |
| `pnpm all:storybook` | The above plus Storybook at `http://localhost:6006` |
| `pnpm all:web` | Web only (no Docker, API, or database) |
| `pnpm dev:prepare` | Database setup and migrations only |
| `pnpm db:reset` | Delete all data in the configured database and reapply migrations (prompts for confirmation) |

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

New email/password accounts are created in PostgreSQL. Passwords are stored as salted Argon2id hashes (19 MiB memory, 2 iterations, 1 thread), never as readable passwords. New passwords must contain 8–128 characters. Google sign-in uses Firebase, and existing Firebase email/password accounts remain supported through **Use my existing Firebase email account** on the sign-in screen. New registrations always use the local account system.

All methods use the same `users` table and server-side `em_session` cookie. A user can have a local `password_hash`, a unique `firebase_uid`, or both. Public registration always creates a customer; roles come from the database. Existing Firebase profiles and their roles are preserved by the migration.

On page load, the frontend restores the account from `GET /v1/me`, independently of Firebase browser state. Firebase credentials are used temporarily to prove identity and are cleared after exchange. Sessions are stored hashed in the `sessions` table, expire after `SESSION_TTL_DAYS` (default 7), and are deleted on logout. Successful sign-in and linking rotate the current session. If logout fails, the UI keeps the current account visible and shows an error.

### Connecting sign-in methods

Customers and admins open the user icon or user section and choose **Account settings → Sign-in methods**. The customer profile and sign-in methods live in Account settings, rather than a primary navigation tab. Account names and email addresses are currently shown read-only; profile editing is not connected to the API.

- A local account can connect Google or an existing Firebase email account by providing its current local password and signing in to Firebase. The Firebase email must be verified and the sign-in must be within the last five minutes.
- A Firebase account can add a local password by freshly signing in with its already connected Firebase identity. Its verified Firebase email must match the account email. This adds a password; it cannot replace an existing password.
- Matching emails never link accounts automatically. A Firebase sign-in whose email is already registered locally returns a conflict with instructions to sign in using the existing method and connect Firebase from settings. Two already-created database accounts cannot be merged through this screen.
- Linking preserves the database user ID, profile, and role. Firebase login never overwrites the account email or role, including if the Firebase email later changes.

The API verifies Firebase ID tokens with revocation/disabled-user checks before exchanging them or changing sign-in methods. Password endpoints limit attempts per account to 10 per 15 minutes, limit request bodies to 16 KiB, and reject browser POST requests from origins outside `WEB_ORIGIN`. The basic attempt limiter is in memory and resets on API restart; deployments with multiple API processes need a shared gateway/store limit. The database also enforces email uniqueness ignoring case and surrounding whitespace; the migration rejects existing ambiguous email records rather than merging them.

Local password reset and email-verification delivery are not implemented. Firebase-only users must verify their email through Firebase before adding a local password. Do not remove an existing sign-in method as part of linking.

### Optional Firebase setup

1. In the Firebase console, enable **Google** and keep **Email/Password** enabled for existing Firebase accounts.
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
update users set role = 'admin', staff_role = 'System Administrator' where email = 'admin@example.com';
update users set role = 'customer' where email = 'admin@example.com';
```

Reload the app after changing a role so the client fetches the updated profile. The seed script is only a convenience.

### Session API

The auth API routes are:

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /v1/auth/register` | None | Create a local customer account (`displayName`, `email`, `password`) and session |
| `POST /v1/auth/login` | None | Check local `email` and `password`, start a session |
| `POST /v1/auth/sync` | `Authorization: Bearer <Firebase ID token>` | Find/create the Firebase profile by UID and start a session; never merge by email |
| `POST /v1/auth/link/firebase` | Cookie + fresh Firebase token | Connect Firebase after checking `currentPassword` |
| `POST /v1/auth/password` | Cookie + fresh connected Firebase token | Add a local `password` to a Firebase-only account |
| `GET /v1/me` | `em_session` cookie | Return the current profile |
| `POST /v1/auth/logout` | `em_session` cookie | Delete the session and clear the cookie |

Optional config in `apps/api/.env`:

```sh
SESSION_TTL_DAYS=7
```

With curl:

```sh
# Create a local account; the password below is only an example for local testing
curl -c cookies.txt -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Local Customer","email":"customer@example.com","password":"a long example passphrase"}'

# Or exchange a Firebase ID token for a session cookie
curl -c cookies.txt -X POST http://localhost:3000/v1/auth/sync \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" -d '{}'

curl -b cookies.txt http://localhost:3000/v1/me
curl -b cookies.txt -X POST http://localhost:3000/v1/auth/logout
```

The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when `NODE_ENV=production`. The client can never set its own role.

Only System Administrators can manage catalog drafts, the user directory, messages, and booking request statuses. Staff can sign in to view booking requests and the published package and service catalog.

### Seed local accounts and connected demo data

Run this after the database migrations:

```sh
pnpm db:seed
```

This preserves the legacy local admin (`admin1@gmail.com`), five customers (`user1@gmail.com` through `user5@gmail.com`), 10 staff (`staff1@example.test` through `staff10@example.test`), 10 customers (`customer1@example.test` through `customer10@example.test`), three sample package drafts, and 15 venue drafts. It also inserts a separate connected demo: an administrator and five customers, published demo services and packages, package-service assignments, published photo-free demo venues, booking inquiries with status history, and customer-admin conversations. Newly created local fixtures use `p@ssword01`. Use normal email/password sign-in; Firebase configuration is not required. Published demo offers are visible for development but are not approved business prices or terms. The three new demo venues are published without photos; the 15 older synthetic venue drafts remain private.

The command is repeatable and insert-only for existing rows: it preserves accounts, sessions, catalog edits, archives, and unrelated data. Compatibility updates upgrade an untouched incomplete legacy package draft and publish untouched demo venue drafts from the earlier seed. Stable IDs and request references prevent duplicate connected demo records; email collisions may leave a fixture login or its dependent data unavailable. `SEED_RANDOM_SEED` and `SEED_CLOCK` make the randomized details and clock repeatable for tests. The seed uses one PostgreSQL transaction and does not contact Firebase, email, or payment providers. See [database seed](docs/SEED.md) for entity coverage, relationship flow, rerun behavior, and disposable-database verification.

### Auth verification

Run the workspace checks and integration suite:

```sh
pnpm check
pnpm build
pnpm --filter @event-management/api test:auth
```

The auth suite requires the Firebase CLI (`firebase-tools`) on PATH and a running local PostgreSQL instance configured in `apps/api/.env`. The database user needs permission to create a disposable test database. The command starts the Firebase Auth emulator using the `demo-event-management` project, creates a separate database, applies all committed migrations, tests the real routes and Firebase Admin verification, then drops only that test database and shuts down the emulator. It never creates real Firebase accounts or modifies the application database. Ports 9099, 4409, and 4509 must be free.

Coverage includes local registration/login, password hashes, cookie/session persistence, expiry/logout, existing Firebase email accounts, emulated Google identities, conflicts, proof of both accounts for linking, password addition, concurrent linking, disabled Firebase users, validation, throttling, and OpenAPI routes. The emulator verifies the Firebase integration; it does not prove a production Google OAuth popup or production service-account configuration.

## Customer and team messages

Signed-in customers can start direct conversations with the Clemora team, including conversations linked to booking requests. The customer **Messages** tab and the admin **Messages** workspace read the same PostgreSQL records, refresh every five seconds, and show unread counts and each conversation's last update. Opening a thread marks the other side's messages as read. Both sides can send messages of up to 4,000 characters; the API enforces the account role, and a customer can only read their own conversations. A booking-linked thread shows its event type and opens the existing booking details dialog from an info icon. Customer booking details are read-only; System Administrators can update request status there.

Customer and administrator messages retain their sender identity. Conversations are `active` or `closed`; closed history is read-only for staff, and a customer's new message reopens a closed general conversation. AI replies, guest chat import, handoff, and takeover are deferred.

General conversations close after 24 hours without activity. Event-related conversations close 24 hours after the stored event end, so changing the event schedule in the customer **Event details** dialog also changes the expiry. Closed conversations keep their full message history; expiry is checked whenever conversations are read or written.

The conversation retains optional package and event context. A booking request creates its own linked conversation. The public site has no guest chat or AI assistant; customers sign in to message the team.

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /v1/messages/conversation` | Customer session | Load the signed-in customer's conversation, creating it on first use |
| `POST /v1/messages/conversations` | Customer session | Start a customer conversation |
| `GET /v1/messages/conversations` | Customer session | List the customer's conversations |
| `GET /v1/messages/conversations/{id}` | Customer session | Read one owned conversation |
| `POST /v1/messages/conversation/messages` | Customer session | Send a message; reopens a closed general conversation |
| `PATCH /v1/messages/conversation/context` | Customer session | Link a published package or update event type, guests, and schedule |
| `GET /v1/admin/conversations` | Admin session | List all conversations, including empty ones, in pages of 15 ordered by latest update; accepts an optional `cursor` and returns `nextCursor`, status, last message, and unread count |
| `GET /v1/admin/conversations/{id}` | Admin session | Load a customer conversation |
| `POST /v1/admin/conversations/{id}/messages` | Admin session | Reply to a customer |
| `GET /v1/booking-requests/{id}` | Customer session | Read one owned request with status history |
| `GET /v1/admin/booking-requests/{id}` | Staff session | Read one request with status history |

`pnpm --filter @event-management/api test:messages` runs the messaging behavior suite against a disposable local database, including ownership, sending, read state, and expiry. Apply the forward migration with `pnpm db:deploy` on an existing local database. It removes automated assistant/handoff messages and AI routing state while preserving human messages and conversations.

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

update users set role = 'admin', staff_role = 'System Administrator' where email = 'admin@example.com';
```

Reload the app after changing a role; the client caches the profile until the next page load or sign-in.

## API routes and shared UI

For a new API feature, define a Zod schema and `createRoute` with its typed handler in a verb–entity file under `apps/api/src/controllers/<domain>/`. Register the route in that domain's `index.ts` and mount it in `apps/api/src/app.ts`. Put business rules and transaction orchestration in `apps/api/src/services/<domain>/` and focused Kysely queries in `apps/api/src/data/<domain>/`. Shared helpers live in `apps/api/src/utils/`. Files use kebab-case and exported operations use `Route`, `RouteHandler`, `Service`, or `Data` suffixes. Existing API JSON field names remain unchanged.

Theme tokens live in `packages/theme/src/theme.css`. Reusable React components and their styles live in `packages/ui`; the shared library includes the wordmark, buttons, badges, icons, stat cards, links, navigation, section counter, and inclusion strip. The workspace and public page layouts live in `apps/web/src`. Published package previews on `/` and in its View more overlays can start a booking request. Quotes, payments, and confirmed bookings are later work.
