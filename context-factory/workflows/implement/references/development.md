# Development setup and verification

## Workspace layout

```text
apps/
  web/                 Astro host, React screens, client auth and API calls
  api/                 Hono controllers, services, data queries, Prisma and tests
    compose.yaml       Local PostgreSQL service
  supabase/            Local Supabase CLI project; not the API database
packages/
  contracts/           Shared field, file and collection limits
  theme/               Design tokens and CSS variables
  ui/                  Shared React components and Storybook
scripts/               Development startup
context-factory/       Contributor guides, agent workflows and QA helpers
docs/                  Seed guide and interview summary
transcriptions/        Individual and combined interview transcripts
```

Astro renders public pages under `apps/web/src/pages` on each request. The standard build targets Node, and `build:workers` targets Cloudflare Workers. `/login` and `/app/*` mount `components/app/App.tsx` with `client:only="react"`. The app keeps its React and authentication providers mounted while same-origin `/app` navigation updates the URL with the History API; public and login routes remain document navigations. `GET /me` chooses the admin or customer shell, and each role keeps only its own `/app` paths. Shared UI uses atomic layers and exports from `packages/ui/src/index.ts`. Theme tokens live in `packages/theme/src/theme.css`; app styles live in `apps/web/src/styles/`. Web files follow the [frontend structure contract](../../../areas/frontend/references/project-structure.md), organized by layer, domain, and responsibility.

API routes are mounted under `/v1` in `apps/api/src/app.ts`. HTTP contracts and handlers belong in `controllers/<domain>/`, business operations in `services/<domain>/`, and Kysely queries in `data/<domain>/`. Shared helpers belong in `utils/`. The running API exposes its OpenAPI contract at `/openapi.json`.

## Local development

Requires Node.js 22.22+, pnpm (the version is pinned in `package.json`), and Docker with Docker Compose.

Use `.room/<name>` for isolated test environments, with short names such as `catalog`, `quotes`, or `pr45`. From the primary checkout, run `pnpm room create quotes HEAD` for a new room or `pnpm room start quotes` for an existing one. Both commands install dependencies, start the room's own Supabase stack, deploy that revision's migrations, seed test data, and start its Node API, website, and background worker before checking readiness. Each room has its own ports, browser loopback address, containers, database volume, and Storage. `pnpm room status quotes` shows its URLs; `pnpm room stop quotes` stops only that room and retains its data. Follow the [worktree guide](worktrees.md) for credentials, optional providers, and cleanup. Worktree contents are ignored by the parent checkout and its formatting/lint sweeps.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the local Supabase stack, serves the edge function, starts the background worker, and starts the website at <http://localhost:4321/>. `pnpm all` remains the Compose PostgreSQL path: it creates `apps/api/.env` from its example if missing, starts PostgreSQL and waits for its healthcheck, applies committed migrations, then starts the Node API, background worker, and web servers. Local email/password sign-in works without Firebase configuration. Catalog uploads use the private Supabase Storage bucket `event-management`; uploads start at `pending/<admin-id>/<media-id>.<ext>` and move into package, service, or booking folders when saved. The edge runtime supplies its own Storage URL and service role. The Node API needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the API example.

**Existing databases:** review pending migrations and back up affected data before `pnpm all`, `pnpm dev:prepare`, or `pnpm db:deploy`; these commands apply migrations. See [migration impact](#migration-impact).

| Service                               | Local URL                                           |
| ------------------------------------- | --------------------------------------------------- |
| Website and workspaces                | <http://localhost:4321/>                            |
| Edge function health, from `pnpm dev` | <http://127.0.0.1:54321/functions/v1/api/v1/health> |
| Node API health, from `pnpm all`      | <http://localhost:3000/v1/health>                   |
| Node OpenAPI, from `pnpm all`         | <http://localhost:3000/openapi.json>                |
| Storybook, when started               | <http://localhost:6006/>                            |

| Command                                      | Purpose                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Start local Supabase, the Edge function, the background worker, and the website   |
| `pnpm all`                                   | Start Compose PostgreSQL, apply migrations, and run the Node API, worker, and web |
| `pnpm all:storybook`                         | Start the Compose stack, Node API, worker, web, and Storybook                     |
| `pnpm all:web`                               | Run only the frontend                                                             |
| `pnpm dev:prepare`                           | Prepare PostgreSQL and apply migrations                                           |
| `pnpm storybook`                             | Run only Storybook                                                                |
| `pnpm db:up` / `pnpm db:down`                | Start / stop PostgreSQL; stopping retains its volume                              |
| `pnpm db:seed`                               | Insert local fixtures, sample catalog data, and the interconnected scenario       |
| `pnpm supabase:start` / `pnpm supabase:stop` | Start / stop the local Supabase stack in `apps/supabase`                          |
| `pnpm supabase:status`                       | Show local Supabase URLs                                                          |
| `pnpm agents:sync`                           | Sync additions across `.agents`, `.agent`, `.claude`, and `.cursor`               |

`pnpm agents:sync` runs once and copies missing entries from any of the four folders into the others, including hidden files, subfolders, and symbolic links. It creates missing folders and preserves existing files. Conflicting contents or entry types at the same relative path are reported and skipped, including descendants of conflicting paths; the command exits with status 1 after syncing unambiguous additions. It does not propagate edits or deletions: a file removed from one folder is restored from another on the next run. Rerun it after adding files to any folder.

`Ctrl+C` in `pnpm all` stops the Node API, worker, and website; Compose PostgreSQL stays running until `pnpm db:down`. Run the seed with Supabase Storage configured. On a fresh database, it creates 10 public packages, 10 public services, four showcases, a demo business profile, and AMAC guidance. The catalog and showcases use bundled illustrative photos. Reruns preserve existing listings, including their edits and archive state. See the [seed guide](../../../../docs/SEED.md) for setup, fixture coverage, and optional embedding backfill.

### Local Supabase

`apps/supabase` is the local Supabase CLI project, pinned to CLI 3.0.0. `pnpm supabase:start` requires Docker and starts its own Postgres 17, Studio, and Storage. Postgres listens on `127.0.0.1:54322`, the API gateway on `54321`, and Studio on `54323`. This stack can run beside `pnpm db:up`. Local Storage declares the private `event-management` bucket in `apps/supabase/config.toml`. Restart the stack after pulling that bucket so Storage creates it. Catalog uploads use owner folders described in [catalog media](../../../areas/api/references/external-image-urls.md). The folder structure applies to new uploads; existing development files do not need relocation.

Run one `pnpm dev` or `pnpm dev:edge` session at a time. Both commands claim UDP port `54321` on loopback for the lifetime of the session. The gateway uses TCP on the same port. If startup reports that another session manages Edge, stop that session before starting a new one.

The Node API, Prisma, and seeds use the database selected by `SUPABASE_DB_URL`. The example points to Compose PostgreSQL on port 5432. The local Edge function and its background worker connect to the local Supabase database. Application sign-in uses the API's own sessions.

`pnpm dev` starts this stack when it is not already running, bundles the Hono routers into one Edge Function at `apps/supabase/functions/api`, and serves that function with the website and a separate Node background worker. A request loads only the matching route family. The browser calls the website origin at `/v1`. The Astro dev server proxies that path to `http://127.0.0.1:54321/functions/v1/api`. The Supabase gateway sends `Access-Control-Allow-Origin: *` and answers preflight itself; browsers reject that header when a request includes the session cookie, so the page does not call the gateway directly. Direct checks, such as the health URL in the service table, can still use the gateway. The function reads `apps/supabase/.env.functions`, which `pnpm dev` creates when missing. Supabase injects a container-addressed database URL into the local function. The local edge runtime uses `oneshot` mode so a bundle rebuild does not hot-reload the container. Restart `pnpm dev` after `pnpm build:edge` to load a new bundle. If the function server exits, `pnpm dev` starts it again and leaves the website running. `Ctrl+C` stops these processes; the Supabase stack stays up until `pnpm supabase:stop`.

### Configuration

Each app exports a single `config` object of raw environment values. Config consumers validate and parse the settings they use.

- [`apps/api/src/env.ts`](../../../../apps/api/src/env.ts) serves Node, the Edge bundle, and API commands. Values are captured when the module loads. Node entry points load dotenv first. Firebase, Storage, and AI settings are checked at use.
- [`apps/web/src/env.ts`](../../../../apps/web/src/env.ts) serves the browser, the web server, and Astro config. Vite captures explicit `PUBLIC_*` settings at build time. Server settings are captured from the Node environment at module startup. Astro config can read shell-provided settings before Astro loads `.env` files.

App consumers import `config` from their app's `src/env.ts`. `pnpm check:env` checks direct environment reads in app source and runs in `pnpm check`. Tests and generated Edge bundles are excluded. Compose and Supabase configuration use their native environment loading.

Use the checked-in [API environment example](../../../../apps/api/.env.example) and [web environment example](../../../../apps/web/.env.example) for variable names. Keep `.env`, `.secrets/`, database values, session tokens, and service-account contents out of chat and commits.

- Set `SUPABASE_DB_URL` in `apps/api/.env` for the Node API, standalone worker, Prisma, and type generator. Use a PostgreSQL URI and percent-encode reserved characters in credentials. For `pnpm all`, match the URI to the Compose credentials and published port. Compose and disposable integration tests still use the split `DB_*` settings in the API example. Supabase injects `SUPABASE_DB_URL` into local and hosted Edge functions. The local Node worker uses the host-accessible database URL from Supabase CLI status.
- API listener: `API_PORT` defaults to `3000`. Browser/server API URLs remain separately configured; changing the listener port does not rewrite them.
- Web proxy: optional `API_PROXY_TARGET` points to the Supabase gateway. `pnpm dev` sets it for both Astro config and request-time proxying. The catalog server loader prefers this proxy; otherwise it uses an absolute `PUBLIC_API_URL`, with `http://127.0.0.1:3000/v1` as its server fallback.
- Browser API: `PUBLIC_API_URL` points to the API including `/v1`. `pnpm dev` sets it to `/v1` on the website origin. `pnpm all` uses the web environment value, which defaults to `http://localhost:3000/v1`.
- Conversation and notification Realtime use `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the web environment. For local development, use the local project's URL and publishable key from `pnpm supabase:status`. Set the server-only `SUP_JWT_KEY` to the HS256 JWT secret trusted by the target project's Realtime service (at least 32 bytes). Local Edge reads it from `apps/supabase/.env.functions`; use the local project's `JWT_SECRET`. For hosted Edge, set it in Edge Function Secrets to the project's active legacy JWT secret. This signer emits HS256 tokens without a key ID and requires Realtime to accept that shared secret. The standalone Node API reads it from `apps/api/.env`. Setting the function secret alone does not configure Realtime to trust a new key. For a hosted project, disable **Allow public access** in its Realtime settings. Apply the conversation and notification migrations to the same database the app writes to. `POST /v1/auth/realtime-token` accepts `{ conversationId }` for a single conversation or `{ scope: "notifications" }` for the signed-in account's bell. Each token permits receiving on its own private channel and expires after at most five minutes. Keep signing keys on the server. Realtime rechecks access on join or renewal. An already authorized connection can receive events until token expiry after server-side session revocation. Polling recovers updates when Realtime is unavailable.
- AI replies: set server-only `AI_GATEWAY_API_KEY` and `TEXT_MODEL` (selected: `deepseek/deepseek-v4.1-flash-1017`) in `apps/api/.env` for Node or `apps/supabase/.env.functions` for local Edge. The files are separate; restart the function server after changing Edge settings. Configuration is checked on use; decision and embedding settings are not required for text replies.
- Catalog embeddings: set server-only `AI_GATEWAY_API_KEY`, `EMBEDDING_MODEL=google/gemini-embedding-2`, and Storage configuration for the background worker. Apply the catalog knowledge and background jobs migrations to the target database. Catalog saves enqueue durable owner jobs for eligible chunks; the worker retries failures according to its code-owned policy. Starting a worker can process queued jobs and make paid provider calls. See [background jobs](../../../areas/background-jobs/SKILL.md) for behavior and extension guidance.
- `pnpm dev` starts `node scripts/dev-background-jobs.mjs`, which configures a separate Node worker from local Supabase status and `apps/supabase/.env.functions`. It and `pnpm room` prefer the local CLI's `SECRET_KEY` for Storage and fall back to `SERVICE_ROLE_KEY` when needed. Run the script independently for the same local Supabase setup. `pnpm all` and `pnpm all:storybook` start a worker using the API environment. For independent execution, `pnpm worker:background-jobs` uses `apps/api/.env` or explicit platform environment variables; its default local configuration targets Compose PostgreSQL. The local Edge function uses `oneshot` and does not poll persistently; hosted Edge deployments need a separately supervised Node worker with the same database, Storage, and AI configuration. `pnpm --filter @event-management/api catalog:embed` remains a separate full reconciliation/backfill command that makes paid provider calls. The Knowledge Catalog's **Index pending** submits jobs to the same worker without waiting for provider work.
- Image processing: the Node worker handles mandatory interpretation and image-triggered customer/guest replies. Configure server-only `AI_GATEWAY_API_KEY`, `VISION_MODEL`, `TEXT_MODEL` and Storage settings for that worker; Edge send routes accept uploads and enqueue image jobs. Starting this worker may process pending image jobs and incur model usage.
- Catalog media: set the Supabase Storage variables in the API example before testing Node API uploads. Legacy built-in package photos are served directly from the application. Existing stored files are left in place.
- Database clients such as DBeaver: use PostgreSQL on `localhost:5432` with the configured database name/user/password. The local defaults use no SSL. A containerized client may require `host.docker.internal` instead of `localhost`.

### Production Supabase deployment

From the workspace root, `pnpm prod:supabase:deploy` builds the `api` Edge Function, applies pending Prisma migrations, uploads runtime secrets, and deploys the function to the selected project. Review [migration impact](#migration-impact) before deploying to a populated database.

1. Set `SUPABASE_ACCESS_TOKEN`, `PROD_SUPABASE_REF`, and `PROD_SUPABASE_DB_URL` in `apps/api/.env`. The token needs permission to write functions and secrets. In the target project's **Connect** dialog, choose **Direct connection** or **Session pooler** on port 5432. Percent-encode reserved characters in the password before placing the URI in the env file.
2. Copy [the production function example](../../../../apps/supabase/prod/.env.functions.example) to `apps/supabase/prod/.env.functions` and set `WEB_ORIGIN` to the production frontend's HTTPS origin. Add feature settings that need to be uploaded. Supabase injects `SUPABASE_DB_URL` into the function. Use `apps/supabase/.env.functions` for local development.
3. Start Docker and run `pnpm prod:supabase:deploy`. The Supabase CLI bundles the function locally to fit the deployment size limit. A failed step stops the command. Earlier successful steps take effect immediately. After correcting the failure, rerun the command to finish the release.

### Cloudflare Workers frontend

Connect Workers Builds to the `event-management` Worker named in [Wrangler config](../../../../apps/web/wrangler.jsonc).

| Workers Builds setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Build command | `pnpm run build:workers` |
| Deploy command | `pnpm exec wrangler deploy` |
| Build variables | `NODE_VERSION=24.15.0`, `PNPM_VERSION=11.21.0` |

`build:workers` generates `dist/server/wrangler.json` and its `.wrangler/deploy/config.json` redirect. Both paths are ignored by Git. A fresh checkout needs the Workers build before Wrangler can deploy the frontend. If you only deploy the production branch, you can leave the Build command empty and set the Deploy command to `pnpm run deploy:workers` to run both steps in order.

The Workers build sets the browser's API URL to `/v1`. Set `API_PROXY_TARGET` in the Worker's runtime variables to the hosted Supabase gateway origin, such as `https://<project-ref>.supabase.co`. The Worker forwards `/v1/health` to `/functions/v1/api/v1/health` on that gateway and uses the same API for server-rendered catalog pages.

The target needs the Clemora `api` Edge Function and matching database schema. Include the frontend's exact HTTPS origin in the function's `WEB_ORIGIN` and set `NODE_ENV=production` for secure session cookies. For Realtime, add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the build variables. Optional Firebase sign-in also needs its `PUBLIC_FIREBASE_*` build variables and the Worker hostname authorized in Firebase.

From `apps/web`, verify the build and deployment bundle with `pnpm run deploy:workers --dry-run`. With the local Edge API running, use this command to serve the bundle.

```sh
pnpm exec wrangler dev --ip 127.0.0.1 --port 8787 --var API_PROXY_TARGET:http://127.0.0.1:54321
```

Open `http://127.0.0.1:8787/v1/health` and expect HTTP 200 with `{"status":"ok"}`. Open `/packages` to check catalog rendering. For local sign-in, add `http://127.0.0.1:8787` to the local Edge function's `WEB_ORIGIN` and restart that function.

See the [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) and [Workers Builds setup](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## Authentication

New registrations create local customer accounts with Argon2id password hashes; passwords must contain 8–128 characters. Password hashing uses WebAssembly through `hash-wasm` in both Node and the Edge Function, with 19 MiB of memory, two passes, and parallelism one. Existing Argon2id hashes remain valid; no password reset or database migration is needed. Google sign-in and existing Firebase email/password accounts are optional identity methods. Application roles always come from PostgreSQL.

Run `pnpm --filter @event-management/api test:password` for password compatibility checks. With the current Edge bundle served by `pnpm dev` or `pnpm dev:edge`, run `pnpm --filter @event-management/api test:edge` to check session rejection, unknown-account password verification, route matching, and OpenAPI loading in the local runtime. After changing API code, rebuild with `pnpm build:edge` and restart the function server before running those runtime checks.

All methods use the `em_session` cookie and hashed sessions in PostgreSQL. The frontend restores the account with `GET /v1/me`. While the workspace remains open, it rechecks `/me` when the page regains focus or visibility and after a non-authentication data request returns `401`. A successful check refreshes the profile; a `401` clears it and returns the user to login with the local workspace URL saved for sign-in. Same-origin `/app` navigation uses browser history and does not remount the authentication provider. Sessions expire after `SESSION_TTL_DAYS` (default 7), rotate on successful sign-in/linking, and are deleted on logout. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

Account settings → Sign-in methods supports connecting Firebase to a local account after proving the current local password, or adding a local password after proving the connected Firebase identity. Firebase proof requires a verified email and a sign-in within five minutes. Matching emails never merge accounts automatically; linking preserves the database identity and role. Profile editing, local password reset, and local email-verification delivery are not implemented.

The only account roles are `customer` and `admin`. Admin access belongs to designated System Administrators; public registration creates customers, and the browser cannot assign or promote a role. Reload after an authorized role change so the frontend refreshes its profile.

Password attempts are limited in memory per account; multiple API processes require a shared limiter. Browser writes must pass the configured `WEB_ORIGIN` check. See the [authentication reference](../../../areas/api/references/auth-and-sessions.md) and running OpenAPI contract for route details.

### Optional Firebase setup

1. Enable Google and retain Email/Password for existing accounts in Firebase Authentication. Add `localhost` to authorized domains for local development.
2. Fill in the `PUBLIC_FIREBASE_*` fields in `apps/web/.env` using the web app configuration.
3. Configure `FIREBASE_PROJECT_ID` on the API and either `GOOGLE_APPLICATION_CREDENTIALS` pointing to a gitignored service-account JSON or `FIREBASE_CLIENT_EMAIL` plus `FIREBASE_PRIVATE_KEY`. Relative credential paths resolve from `apps/api`.
4. For a Firebase-backed admin, run `pnpm db:seed-admin admin@example.com` after configuring Firebase. The command finds the Firebase user or creates one when `ADMIN_PASSWORD` is supplied, then assigns the database System Administrator role. For local-only fixtures, use `pnpm db:seed` instead.

The API verifies Firebase ID tokens, including revocation/disabled-user checks, before identity exchange or linking. A Firebase token alone does not grant catalog administration.

## Database workflow

For schema changes, edit `apps/api/prisma/schema.prisma`, create and review the migration, then regenerate Kysely types:

```sh
pnpm db:migrate
pnpm db:generate
pnpm check
```

`pnpm db:deploy` applies committed migrations; it does not create migrations. Never hand-edit generated `apps/api/src/db/types.ts`. Inspect both Prisma and SQL migrations because some database constraints extend beyond the Prisma model.

The type generator includes application tables in `public` only, excluding Supabase's internal schemas. Migration `20261110141853_event_day_staffing` is historical: it introduced operational event days along with availability and assignment tables. Later additive migrations remove those tables and response fields while keeping admin event-day scheduling.

Migration `20261109140000_enable_application_rls` enables row-level security on application tables and Prisma's migration history. It removes table grants from `PUBLIC` and, when present, Supabase's `anon` and `authenticated` roles. Clients access records through Clemora's session-aware API; there are no direct-client RLS policies. The server database role must own the tables or have `BYPASSRLS`. Future table-creation migrations must explicitly enable RLS and remove unused client grants too; this migration does not install an automatic trigger. These SQL-only access settings do not change Prisma models or generated Kysely types.

Migration `20261111150000_simplify_quotation_offers` deliberately discards quotation package timestamps and full package/event-term snapshots. It preserves quotation IDs, package references, amounts/items, status and acceptance timestamps, revision links, audit events, and quotation messages. It does not delete Storage objects; normal cleanup can remove uploads that no current widget references. Deploy the matching API and web changes together with this migration.

Migration `20261120124456_derive_conversation_activity` removes conversation `status`, `closed_at`, and `guest_expires_at`, preserving conversations, messages, quotation links, ownership, and AI preferences. Previously closed signed-in conversations become available. Anonymous expiry is derived from the latest saved message or creation time. Deploy the matching API, frontend, and background worker together; older runtimes query removed columns. The migration replaces the guest ownership check and active-thread unique index with ownership validation and a guest-history lookup index. Bootstrap serializes on the guest identity to reuse one unexpired thread without deleting expired history.

Migration `20261120121409_remove_quotation_acceptance` removes `quotations.accepted_at`, the `accepted` quotation status, and its partial unique index. It does not transform quotation rows or support retired statuses. Acceptance timestamps are deliberately discarded, while supported quotation versions, prices, adjustments, revision links, delivery messages, and audit history remain. Booking-request acceptance is unchanged. Deploy the matching API and web code with this migration and regenerate database types.

Migration `20261111120000_booking_requested_days` adds nullable JSONB `booking_requests.requested_days` with a check that non-NULL values are nonempty arrays. SQL `NULL` identifies requests created before customers selected a complete date list. The migration does not backfill dates or rewrite the legacy estimate, timestamps, snapshots, conversations, or operational event days.

Migration `20261114000000_drop_venues` removes the venue catalog and its package link; `20261114010000_drop_staff_tables` removes availability and assignment tables plus event-day staffing fields. The additive `20261114151517_complete_catalog_staff_removal` migration revokes sessions for former staff and admins without the System Administrator designation, converts those accounts to customers, and drops `users.staff_role`. At that stage, it also deletes catalog pages left without an owner, restores the temporary package/service page-owner constraint, and removes coordinator/checklist delivery metadata. Migration `20261116072801_embed_catalog_canvas` later embeds the remaining canvases and drops the page hierarchy. Follow-up migration `20261114154206_remove_event_checklists` drops the event-checklist table and its content validator, removing stored task definitions and progress. The migrations keep shared media assets and Storage objects; `pnpm --filter @event-management/api media:cleanup` removes stale unreferenced media through the existing cleanup path.

Migration `20261116063852_derive_booking_package_details` drops `booking_requests.package_name`, `package_price`, and `package_max_guests`, including their stored values and column checks. Existing requests keep their package references, dates, statuses, conversations, and schedules; package details use the current catalog record, including archived records. Private proposals and saved quotation amounts retain their separate ownership. Deploy this migration with the matching API; old API code requires the removed columns.

Migration `20261116072801_embed_catalog_canvas` adds `packages.canvas` and `services.canvas`, backfills the ordered section/widget arrays while preserving their IDs and content/media references, then drops `catalog_widgets`, `catalog_sections`, and `catalog_pages`. At that stage, package/service owner timestamps, `media_assets`, uploaded Storage objects, and relational `package_services` links were preserved; the later assignment-removal migration below drops the link table. Follow-up migration `20261116090100_validate_catalog_canvas_in_app` removes the SQL canvas validator and its two check constraints without changing canvas data, owner timestamps, defaults, NOT NULL constraints, or GIN indexes. Canvas document validation belongs to the shared browser/API application schemas; direct SQL writes bypass those rules. Deploy the matching application validators with this migration; see the [catalog canvas decision](../../../history/decisions/2026-11-16_catalog-canvas-jsonb.md) and [database guidance](../../../areas/api/references/database-and-migrations.md).

Migration `20261118121512_remove_package_services` drops `package_services` and its included/optional assignments. It preserves package/service records and canvases, prices, bookings, quotations, audit history, and media. It removes only derived overview chunks for packages that had assignments, preventing old inclusion text from remaining searchable; those overviews remain pending until the ordinary catalog save or `pnpm --filter @event-management/api catalog:embed` workflow recreates them. The latter command calls the configured embedding provider. Package request/response contracts no longer contain `services`; old payloads are rejected. Deploy the matching API and frontend with this migration. Historical migrations still create the table before its removal and must remain unchanged. See the [removal decision](../../../history/decisions/2026-11-18_remove-package-service-assignments.md).

Migration `20261116090000_service_fixed_pricing` adds nullable `services.fixed_price_pesos` and `services.included_hours`. The constraint permits hourly-only rows with both fields null or fixed pricing with both positive and a non-null hourly rate. Existing service rates, including legacy null rates, are preserved. The migration does not change quotation data or calculations.

Migration `20261116103220_add_catalog_knowledge` enables pgvector and creates the empty `catalog_knowledge` table without changing catalog records or Storage objects. The PostgreSQL server must provide the `vector` extension; plain `postgres:17` images do not include it. The migration reuses an existing extension in its current schema. Each row has exactly one package/service owner, a unique chunk key within that owner, and either an entirely pending or entirely populated embedding state. Owner and media deletion cascade to their derived rows. RLS and revoked client grants preserve server-only access. The ingestion services enforce catalog-only, non-archived eligibility, input invalidation, and stale-result protection; these behaviors are not supplied by foreign keys or this migration. Admin search enforces current-source and model/preprocessing compatibility. Any future customer retrieval must additionally enforce its customer visibility policy before exposing evidence.

Migration `20261116083246_conversation_ai_control` adds `conversations.ai_enabled` (default true) and `ai_version` (default zero). It preserves messages and existing conversation status, and does not infer historical takeover from old admin messages. Apply it before the matching API; deploy the updated API and browser contracts together.

Migration `20261116155140_anonymous_guest_chat` adds server-only guest identities and message-request deduplication, guest conversation ownership/deadlines/counts, and explicit anonymous message provenance. Existing account-owned conversations and messages remain intact. Exclusive ownership and sender constraints, a unique active guest conversation per identity, RLS, and revoked direct client grants protect the new state. Apply the migration before the matching API and deploy the browser contract changes together; the generated Kysely types include the new tables and nullable customer ownership. Claimed anonymous messages retain their original provenance.

Migration `20261116061207_add_ai_message_replies` makes the message sender nullable only for the new `assistant` role; human sender IDs remain required. It preserves existing messages and conversation lifecycle. Deploy the matching API and browser contracts together.

**`pnpm db:reset` deletes data without a confirmation prompt.** It removes Clemora's Realtime helpers and policies, resets the `public` schema, replays committed migrations, and seeds the configured database. Check the target and use it only for a database whose contents may be discarded.

### Migration impact

Migration `20261121100500_business_information` adds one empty business-profile record in `business_information`, with a singleton constraint, JSONB content, and an update timestamp. It enables RLS and revokes direct client table access; public reads and admin writes go through the API. Apply this additive migration before deploying the matching API and web builds. This task verifies disposable local databases; application and hosted database rollout is separate.

Migrations `20261121010200_notifications` and `20261121010300_notification_realtime` add the recipient-owned inbox and private Supabase Broadcast for new alerts and read-state changes. Existing activity starts with an empty notification history. Deploy the migrations with the matching API and web builds. On PostgreSQL without Supabase Realtime, the bell loads and reconciles through the API.

Migration `20261121000000_quotation_package_addons` extends the quotation JSONB checks for copied add-on terms, calculated amounts, and complete sent versions. Existing quotation rows retain their values and shape. Apply the migration before deploying the matching API and web release.

Migration `20261120120000_package_service_terms` originally added package-owned add-ons. Migration `20261122020000_booking_request_service_offers` moves live offers to booking requests and removes that column while retaining historical audit and quotation records. Deploy it with the matching API and web builds. Existing service widgets retain unspecified terms when none were saved.

Review all pending migrations before upgrading a populated database:

- `20261102130000_package_canvas` removes existing packages, package versions and service assignments, booking requests and status history, and booking-linked conversations/messages. General conversations and messages remain.
- `20261102180000_flat_services_venues` retains selected current content, or archives the latest content when none was published. It removes version tables and unselected canvas pages; uploaded storage objects are not deleted.
- `20261102190000_cleanup_catalog_fields` renames guest limits to `maxGuests` / `max_guests` and snapshots to `packageMaxGuests` / `package_max_guests`. It discards package event types, venue categories/photo URLs, and legacy service-image references. Existing canvas content and inquiry snapshots remain. Legacy storage objects are not removed remotely.
- `20261109140000_enable_application_rls` preserves records and blocks direct table access for Supabase client roles. Apply it as the table owner and verify the API database role before deployment. `pnpm db:deploy` targets the database configured for the API; creating this migration does not apply it to the separate local Supabase stack.
- `20261111120000_booking_requested_days` adds the nullable requested-date JSONB column and array constraint without fabricating missing dates or rewriting existing booking data.
- `20261114000000_drop_venues` removes venue listings, package/venue links, and the venue catalog-page owner column. Any ownerless pages are deleted by the follow-up cleanup migration.
- `20261114010000_drop_staff_tables` removes event availability and assignment tables and the event-day response fields.
- `20261114151517_complete_catalog_staff_removal` revokes sessions and converts staff and non-designated admin accounts to customers, leaving designated System Administrators as admins. It drops the remaining staff-role and coordinator/checklist-delivery fields, deletes ownerless catalog pages, restores the temporary package/service owner check, and preserves media assets and Storage objects; the later embed migration drops the remaining page hierarchy.
- `20261114154206_remove_event_checklists` drops `event_checklists` and `clemora_checklist_content_valid(jsonb)`, removing saved checklist tasks and progress. Earlier migration files remain unchanged as historical evidence.
- `20261116072801_embed_catalog_canvas` moves package/service canvas content into owner JSONB arrays, preserving section/widget IDs, order, content, and media IDs before dropping the former page/section/widget tables. It does not change media assets or uploaded objects.
- `20261116090000_service_fixed_pricing` adds paired nullable fixed-price and included-hours fields to services, requiring both to be positive together and requiring an hourly rate when fixed pricing is set. Existing hourly rates remain unchanged.
- `20261117000000_optional_booking_package` permits a null catalog package on booking requests and updates the existing catalog-only trigger to accept that state. Existing package associations, requests, messages, permissions, and private proposals remain intact. Deploy the matching API and browser code together: package fields are nullable, and a missing proposal is a valid read state.
- `20261124120000_move_showcase_gallery_to_media_assets` transfers gallery ownership and position to `media_assets` and removes the old link table and separate preview-video field. It preserves showcase IDs, covers, gallery assets and order, and Storage objects during migration. It rolls back if a gallery asset belongs to more than one showcase. Apply it with the matching API and browser code.

Back up affected records before deployment. Apply coordinated API/frontend contract changes with their migrations; do not edit applied migrations or reset a database to resolve drift. The [database guidance](../../../areas/api/references/database-and-migrations.md), [catalog media reference](../../../areas/api/references/external-image-urls.md), and [seed guide](../../../../docs/SEED.md) provide the related procedures.

## Source formatting

Run `pnpm format` to format source and configuration files with Prettier, then fix
blank-line spacing with ESLint. Run `pnpm format:check` to check both without
writing changes. Prettier covers JavaScript, TypeScript, React JSX/TSX, CSS, JSON,
and YAML; `prettier-plugin-astro` adds Astro files. It uses two-space indentation
and an 80-character wrapping target.

The [ESLint configuration](../../../../eslint.config.mjs) adds blank lines after import groups,
between top-level declarations, around callback declarations and control flow,
and before returns in JavaScript, TypeScript, TSX, and Astro scripts. Consecutive
simple scalar declarations stay together. Existing intentional blank lines
are preserved; logical grouping still needs judgment. Run `pnpm lint` to check
spacing alone or `pnpm lint:fix` to fix it. `pnpm check` also runs the spacing check.

In VS Code or Cursor, install the recommended Prettier and ESLint extensions to
format and fix spacing on an explicit save. The Astro extension is also recommended.
Generated files, lockfiles, migrations, assets, local data, imported agent tooling,
and historical documentation are excluded through `.prettierignore` and the matching
ESLint ignores. The root README remains included so these instructions can be
checked with the source.

## Verification

Run the checks matching the changed area:

| Command                                                          | Checks                                                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                                     | Source spacing, environment boundaries, web structure, and workspace types                                                                                            |
| `pnpm lint`                                                      | JavaScript, TypeScript, TSX, and Astro script blank-line spacing                                                                                                      |
| `pnpm format:check`                                              | Source formatting without changing files                                                                                                                              |
| `pnpm check:design`                                              | Web controls use shared UI exports; authored web/UI colors use theme tokens. Source checks do not establish visual or behavioral correctness.                         |
| `pnpm build`                                                     | Web production bundle and API types                                                                                                                                   |
| `pnpm build:storybook`                                           | Shared UI rendering build                                                                                                                                             |
| `pnpm db:validate`                                               | Prisma schema                                                                                                                                                         |
| `pnpm check:env`                                                 | Raw environment reads stay in each app’s src/env.ts. Tests and generated bundles are excluded                                                                    |
| `pnpm test:env`                                                  | Raw environment snapshots, client and server settings, Firebase initialization, and env-check fixtures                                                       |
| `pnpm check:web-structure`                                       | Web placement, naming, and runtime import rules; does not establish domain semantics or browser behavior                                                              |
| `pnpm check:guidance`                                            | Context-factory links, anchors, skill metadata, registration, and reachability; does not verify agent compliance or application behavior                              |
| `pnpm --filter @event-management/api test:auth`                  | Authentication and sessions with PostgreSQL and Firebase Auth emulator                                                                                                |
| `pnpm --filter @event-management/api test:background-jobs`       | Queue and worker behavior, retries, leases, cancellation, and enqueue atomicity using isolated fixtures                                                               |
| `pnpm --filter @event-management/api test:packages`              | Package/service catalog and shared canvas behavior                                                                                                                    |
| `pnpm --filter @event-management/api test:booking-requests`      | Inquiry creation and legacy preservation; requested-date validation, per-day time saves, stale writes, calendar counts, status filters, and duplicate-free pagination |
| `pnpm --filter @event-management/api test:conversational-booking` | Review-bound chat submission, stale catalog data, atomic rollback, retries, and form/chat races on disposable PostgreSQL. Set `AMAC_LIVE_TOOL_TESTS=1` with a configured Gateway model to also exercise package discovery through submission. |
| `pnpm --filter @event-management/api test:event-days`            | Requested-day scheduling, event-day creation, movement, cancellation, and permissions                                                                                 |
| `pnpm --filter @event-management/api test:catalog-staff-removal` | Role/session conversion, catalog cleanup, and shared-media preservation                                                                                               |
| `pnpm --filter @event-management/api test:checklist-removal`     | Checklist-table and validator removal, including saved data removal                                                                                                   |
| `pnpm --filter @event-management/api test:quotations`            | Quotation lifecycle, JSONB amounts, permissions, stale writes and atomic conversation delivery                                                                        |
| `pnpm --filter @event-management/web test:proposal-status`       | Interactive quotation/package status controls, conflict refresh, pending-action scope changes, and readable history                                                   |
| `pnpm --filter @event-management/api test:proposal-migration`    | Populated baseline preservation, ownership, JSONB arithmetic, message linkage and RLS/grants                                                                          |
| `pnpm --filter @event-management/api test:messages`              | Conversation ownership, messages, read state, and no automatic expiry for signed-in threads                                                                           |
| `pnpm --filter @event-management/api test:guest-chat`            | Anonymous ownership, quota/replay races, inactivity, claim/revocation, admin handling, and guest migration access constraints                                         |

Integration suites create disposable local PostgreSQL databases and require permission to create them. Auth also requires the Firebase CLI on `PATH` and ports 9099, 4409, and 4509 free; it uses an emulator rather than production Firebase. Media tests use a local Storage API fake rather than production Supabase Storage. See [API verification](../../../areas/api/references/verification.md) and the [seed guide](../../../../docs/SEED.md) for additional focused suites.

For contributor-guidance changes, run `pnpm check:guidance` and `pnpm test:guidance`, then walk the [routing scenarios](../../../routing-checks.md). These verify navigation, registration, and structural routing; they do not prove future agent compliance.

A passing build does not establish browser, persistence, or production-provider behavior. Verify affected customer/admin flows, permissions, reloads, and failure paths at the appropriate boundaries.
