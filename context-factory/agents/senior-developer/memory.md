# Senior developer memory

Durable engineering notes for this role. Read and maintain them under the shared [memory policy](../README.md#memory).

## 2026-11-11 — Seed scenario is insert-only and separate from required fixtures

`pnpm db:seed` keeps the named local accounts, three canvas packages, archived venue samples, and `demo.*` conversations, then runs `apps/api/src/db/seed/scenario/`. That module adds 100 interconnected rows to every application table inside the same transaction. Scenario IDs come from `clemora-scenario-v1` keys. Reruns do not update existing rows. `SEED_RANDOM_SEED` only changes the status shuffle for rows that have not been inserted yet. [Database seed](../../../docs/SEED.md) owns the account bands, counts, and rerun rules.

**Evidence:** `pnpm --filter @event-management/api exec tsx --test tests/seed.test.ts` passed on 2026-11-11 against a disposable migrated database. The test checked scenario counts, booking and event-day distributions, relationship invariants, public catalog reads, password login, and a second run that preserved edited prices and unrelated rows.

**Why it matters:** Do not fold the named fixtures into the 100-row scenario. Confirmed staff assignments belong on accepted bookings whose event day is still scheduled and closed, with an available response. Video scenario rows store metadata only and do not upload bytes.

## 2026-11-09 — Web API calls go through lib/http and lib/data

`apps/web` reaches `/v1` only through `src/lib/http.ts`. Domain endpoint functions live in `src/lib/data/`. `src/lib/services/` owns catalog upload-then-save, the signed-out booking draft, and message-thread merge. `src/lib/utils/` owns name and peso display helpers. There is no `lib/api.ts` barrel.

**Evidence:** `apps/web/src/lib/http.ts` is the only `fetch` in `apps/web/src`. `pnpm --filter @event-management/web check` passed after the move. [Client layers](../../frontend/reference/client-layers.md) owns where a browser API call, client sequence, or pure helper goes. The [frontend structure guide](../../shared/frontend-project-structure.md) keeps the short placement table.

**Why it matters:** Do not add a second fetch wrapper or a browser copy of the API's controllers, services, and SQL modules. A new `/v1` call belongs in the matching `lib/data` module.

## 2026-11-09 — Catalog media uses Supabase Storage

`putCatalogMedia`, `deleteCatalogMedia`, and `getCatalogMedia` call the Supabase Storage REST API. The private bucket is `event-management`. Object keys remain `catalog-media/<id>`, which is the value stored in `media_assets.storage_key`. The hosted Prevail project has that empty bucket. Local `config.toml` declares the same bucket; a running stack needs a restart before Storage creates it. Existing R2 objects are not copied. The package tests fake the Storage API and do not prove a live bucket.

**Evidence:** `apps/api/src/utils/catalog-media-storage.ts`, `apps/api/src/services/catalog-media/catalog-media.ts`, and `apps/supabase/config.toml`. The [catalog media reference](../../api/reference/external-image-urls.md) owns the current route and cleanup behavior.

**Why it matters:** Keep the object key format when changing buckets. Do not send the service role to the browser. The API still proxies bytes through `/v1/catalog-media/{id}`, including byte ranges.

## 2026-11-09 — `pnpm dev` serves the edge function with the website

`pnpm dev` starts the local Supabase stack, builds the edge bundle, serves `functions/api`, and starts the website with `PUBLIC_API_URL=/v1`. The Astro dev server proxies `/v1` to `http://127.0.0.1:54321/functions/v1/api` because Kong answers with `Access-Control-Allow-Origin: *` and handles OPTIONS itself. Credentialed browser calls, including the `em_session` cookie, cannot use that wildcard. `pnpm all` still starts Compose PostgreSQL and the Node API. The function env file is the gitignored `apps/supabase/.env.functions`; its database host is `db` inside the function container.

**Evidence:** Root `package.json` scripts, `apps/web/astro.config.mjs`, and [README local development](../../../README.md#local-development). A direct gateway response on 2026-11-09 included `access-control-allow-origin: *` and `access-control-allow-credentials: true`; its OPTIONS preflight never reached the function.

**Why it matters:** Do not point the browser at the gateway URL in `pnpm dev`, and do not put the website back on port 3000. Keep Prisma, seeds, and integration tests on Compose.

## 2026-11-09 — One Edge Function loads a route family per request

`pnpm build:edge` writes an ESM entry and shared chunks to `apps/supabase/functions/api/_generated`. The function entry strips the Supabase prefix and forwards to that app. The app chooses a route family from the path, dynamically imports only that family, and keeps a loading promise that is dropped if loading throws. `/openapi.json` loads every family. The Node server in `apps/api/src/app.ts` is unchanged and still mounts every router at startup.

**Evidence:** `apps/api/scripts/build-edge.ts`, `apps/api/src/edge/server.ts`, and local `supabase functions serve` on the already running `clemora` stack. Health and the public package list returned 200 from the Supabase database. `GET /v1/admin/packages` and `GET /v1/admin/users` returned 401 without a session. An unknown `/v1` path returned 404. `GET /v1/me` and `/openapi.json` returned 500 because the auth family evaluates `@node-rs/argon2`, which has no Deno binding. The [README local Supabase section](../../../README.md#local-supabase) owns the serve command.

**Why it matters:** Do not mount every controller in the function entry. Leave Argon2, Firebase credential verification, and catalog video bytes for the deferred follow-up. Do not point the Compose API, tests, or seeds at the Supabase database. The local edge runtime stays on `oneshot` in `apps/supabase/config.toml`; `per_worker` hot reload killed the container with exit 137 while the generated bundle changed.

## 2026-11-09 — Local Supabase CLI is not the API database

`apps/supabase` is the local Supabase CLI project (`project_id = "clemora"`, CLI 3.0.0). `pnpm supabase:start` runs Postgres 17, Studio, and Storage on ports 54322, 54323, and 54321. The API, Prisma, seeds, and integration tests still use Compose PostgreSQL from `apps/api/compose.yaml` on port 5432.

**Evidence:** `config.toml`, root scripts, and a running `supabase_db_clemora` reporting Postgres 17.11. The [README local Supabase section](../../../README.md#local-supabase) owns the setup. This start did not apply Prisma migrations or switch `DB_HOST`.

**Why it matters:** A hosted cutover can use this stack for local proof later. Until that change, do not point the API, tests, or seeds at port 54322.

## 2026-11-03 — Engineering and shared toolkit ownership

The [engineering index](../../engineering/README.md) and [Clemora adapters](../../shared/skill-adapters.md) own the local adaptation of the inspected Upskwela engineering/shared toolkit. Root guidance and this role's entry point require the operating contract, principle digest, and engineering index on every task, full applicable skills, and a completion audit. Implementation detail remains with the existing area skills.

**Evidence:** All 41 source skill paths and 8 shared guide paths matched local counterparts; all skill metadata passed the skill-creator validator. `pnpm check:guidance` passed, and isolated fixtures proved that valid navigation passes while missing targets/anchors, unregistered entries, invalid metadata, and missing standing-guide links fail. Manual routing checks covered limits, explanation-only work, review, TypeScript fixes, shared UI, and PR preparation against current source. This establishes guidance coverage and routing, not future compliance or application runtime behavior.

**Why it matters:** Maintain these canonical files without restoring source-project paths, generated-browser-client assumptions, kitchen dependencies, branding, or business policy. Recheck local contracts and scripts when updating the toolkit.

## 2026-11-03 — Verify links after moving guidance

Moving task workflows into the agent's `reference/` folder changed the relative paths to repository and QA guidance. Include new and moved files when checking local links; a tracked diff alone can omit new files.

**Evidence:** The current [code review](reference/code-review.md) and [ticket-writing](reference/ticket-writing.md) guides link to the shared guidance from their new locations. Verified by local Markdown link checks; this establishes guidance integrity only.

**Why it matters:** Future reorganizations need to preserve access to area guidance and ticket templates.

## 2026-11-06 — Shared UI modal and selection contracts

The [Clemora UI skill](../../frontend/clemora-ui/SKILL.md) owns current component-selection guidance. Mounted `Dialog`/`Drawer` use native modal behavior and request dismissal through app callbacks; specialized `NativeDialog` callers retain their own lifecycle. Use `Dialog.initialFocus` for an initially focused field: React's `autoFocus` ran while the native surface was still hidden. A catalog menu must focus its visible summary before opening a modal so closing can restore a usable target. Catalog switches are filter groups; true tablists require linked item/panel IDs.

**Evidence:** The [component follow-up ledger](reference/web-ui-refactor.md#component-contracts-follow-up-2026-11-06) records source review, checks, and Chromium/Storybook consumer journeys. Local response fixtures rejected writes; these results do not prove live authentication, persistence, or provider behavior.

**Why it matters:** Preserve lifecycle ownership and verify focus in real consumers, where hidden menu items and native opening order affect behavior.
