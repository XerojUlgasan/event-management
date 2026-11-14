# Clemora

Clemora is the event-management product for **Prevail Events Management**. This pnpm workspace contains an Astro/React frontend, Hono OpenAPI backend, and shared UI, theme, and contract packages. PostgreSQL stores application records; Prisma owns schema changes and migrations, and Kysely handles runtime SQL.

This README owns product scope, current implementation status, and development setup. The [interview summary](docs/PREVAIL_INTERVIEW_SUMMARY.md) records client evidence and distinguishes it from later scope decisions. The [seed guide](docs/SEED.md) covers development fixtures and repeat runs.

## Product scope

Scope recorded on 2026-11-03, with identity responsibilities and booking-linked communication clarified on 2026-11-11:

| Area | Intended behavior |
| --- | --- |
| Catalogs | Present packages, services, and venues with administrator-managed content. |
| Inquiries and quotations | Let customers start from a package or describe requirements first. Admins communicate with customers, collect missing details, discuss custom packages and added services or venues, prepare quotations, issue revisions, and retain quotation history. Customers discuss offers and request changes through chat; admins handle quotation changes. |
| Availability and booking | Admins review and accept event requests, manage scheduling, and record event changes. Define date holds, exclusive periods, setup/cleanup buffers, and cancellation rules; prevent conflicting confirmations, including simultaneous attempts. |
| Event preparation and workforce | Staff view upcoming event days and volunteer when available; admins select teams and appoint a coordinator from the selected staff. Admins send private timed checklists to the confirmed coordinator, who can edit tasks immediately and track completion; admins monitor progress. Maintain staff profiles, schedules, operational concerns, and notifications. |
| Customer service | Use AI for factual answers from approved information, inquiry collection, and human handoff. Admins retain quotation and commitment decisions. |
| Reports and past events | Report on actual business records and maintain a managed past-events showcase with publication permissions. |
| Access and communication | Automatically create a conversation for each submitted booking request so the customer and admin can communicate and create booking-related transactions. Give customers access to their own inquiries and conversations, and staff access appropriate to their roles. |

The [identity reference](context-factory/business-logic/references/identity.md) defines these intended role responsibilities. Admin means the System Administrator; coordinator is an event responsibility assigned to staff.

The [messages reference](context-factory/business-logic/references/messages.md) describes intended booking-linked communication. Quotations are the implemented booking-related transaction; other transaction types remain undefined within the scope boundaries below.

A request does not reserve a date, establish a final price, or confirm a booking. Confirmation rules remain to be agreed and must not be inferred from payment.

**Outside scope:** all payment responsibilities, including gateways, proof uploads, verification, payment records/status, balances, fee calculation or crediting, and receipts; equipment/inventory management; and supplier management or coordination. Existing demo screens do not establish requirements.

**Later work:** menus, additional policy/term configuration, and AI knowledge maintenance. The staff delivery platform is undecided.

Before implementing dependent work, confirm intake fields and real catalog content/prices; any further quotation format or approval policy changes; availability, confirmation, cancellation and event-change rules; workforce permissions and notifications; assistant sources and handoff ownership; and report/showcase definitions. Meta and other channel integrations require separate decisions.

## Current implementation

| Area | Implemented boundary |
| --- | --- |
| Website and catalogs | `/`, `/about`, `/packages`, `/services`, `/venues`, and their `/{slug}` pages are server-rendered HTML. Cards and View more are links. A catalog title is unique, and its slug is the public address. Book now sits under the package price and guest count and continues at `/login`. `/login` remains a client-rendered document route; same-origin `/app` navigation updates the URL and React workspace through browser history without reloading the document. Public and login destinations still use document navigation; catalog overlays remain inside `/app`. All three catalogs persist in PostgreSQL and support direct saves, canvas content, and archives. |
| Identity | Local email/password and optional Firebase sign-in share database profiles, roles, and server-side sessions. Sign-in returns to a requested workspace path only when it is local and allowed for the signed-in role. The mounted workspace rechecks the session when the page becomes visible and after an eligible data request returns 401; an expired session returns to login with the current workspace path preserved. |
| Booking requests | Signed-in customers submit package inquiries for one or more requested dates. PostgreSQL stores ordered per-day date and time entries, package snapshots, request details, status history, and a linked conversation. Customers supply times after submission; for an accepted request, a System Administrator selects one response-deadline offset for the request and applies it to create operational days from every ready requested date and update current scheduled days. Signed-out drafts resume after sign-in for explicit review and submission. |
| Messages | Customer-to-admin conversations persist in PostgreSQL, including request-linked conversations, unread counts, and read state. Sent quotations appear as exact-version messages; other booking-related transaction types are not implemented. |
| Directory and staff access | System Administrators have a read-only Staff & Customers directory. Staff Event days combines a monthly calendar, searchable table, response filters, and persisted availability controls. Assigned to me shows assignment cards with schedule, role/status, and a details drawer containing the confirmed team. System Administrators review request status and manage event-day staffing on `/app/bookings/{id}`, opened from Admin Bookings or a linked admin conversation. |
| Event-day checklists | One PostgreSQL checklist per event day, with ordered JSONB tasks. Administrators create private drafts and send them to the confirmed coordinator for immediate task editing. Admins monitor the same saved document. Assignment changes revoke the handoff until a fresh send. |
| Quotations | System Administrators prepare booking-owned private packages and versioned PHP quotations. Customers view saved prices, itemized adjustments, and sent history from booking details or the linked conversation, and respond through chat. Only System Administrators create, revise, save, or send quotations. |
| UI feedback | Authentication and workspace actions use shared success, error, and information toasts, including native dialogs. Errors remain until dismissed; brief notices time out. Public catalog failures use persistent inline error notices with retry links; inline validation and retry controls remain available. Demo actions identify when no operation was performed. These notices do not add staff delivery notifications or external messages. |
| Remaining scope | Requirements-first inquiries, booking confirmation and date holds, external workforce notifications, AI replies/handoff, reports, and the managed showcase are not implemented. Other business screens may contain demo or local data. |

### Booking requests and messages

The current intake requires a customer session and a published package. It collects event type (Birthday, Wedding, Corporate, or a custom choice), one date or Multi-day dates, contact name and phone, and optional notes. Multi-day requests need at least two distinct dates; dates may be nonconsecutive and are saved chronologically. The booking timezone comes from the browser and determines whether a date is today or in the future. A signed-out visitor's current-tab draft retains the duration mode, date rows, other fields, and timezone through sign-in, then requires explicit review before submission.

New requests store the complete date list in `requested_days`; `preferred_date` remains the earliest selected date for compatibility. Each requested-day entry starts with no times. Customers can later save start and end times for each unscheduled day from My events or the booking-details modal opened from a linked customer conversation. Both times are required, interpreted in the booking timezone, and may end on the following date for an overnight event. The chosen dates stay fixed. Customers can edit times while a request is `under_review`, `needs_details`, or `accepted`, until an operational schedule is created for that day. Declined and cancelled requests, and already scheduled days, are read-only. Views show “Time to be confirmed” until both times are saved.

The admin Bookings calendar counts a request once on every requested date and applies the same status filter as its results. Selecting any requested date finds the request once in the cursor-paged table; the `preferredDate` API filter matches any requested day for new requests. Legacy rows with SQL `NULL` in `requested_days` keep their recorded preferred date and estimate; the system does not invent additional dates. The admin table shows a compact requested-date summary and links each request to `/app/bookings/{id}`, where the System Administrator can review per-day times and operational schedule state. Staff see only operational `events_day` records, not unconsumed requested dates.

On `/app/bookings/{id}`, requested-date rows appear in the Event days section, including dates still waiting for customer times. The System Administrator selects a requested or operational date to review its schedule and staffing controls. Acceptance and saving times alone create no schedule. For an accepted request, the administrator selects one shared response deadline of 1, 2, 3, or 4 calendar days before the event date; the selected-day workspace previews the cutoff in the booking timezone before the administrator chooses Apply deadlines. For each ready requested date, the API derives the exact saved schedule and creates, links, and opens its operational event day in the same transaction; it also recalculates deadlines for current scheduled operational days using their current dates, including replacement dates. Each deadline is 23:59:59.999 at the end of the calculated date in the booking timezone (for example, a two-day choice for January 1, 10, and 15 yields December 30 of the prior year, January 8, and January 13). Closed staffing stays closed, expired open windows are treated as closed, and moved or cancelled history is retained unchanged. Dates without saved times are skipped; apply the shared choice again after those times are saved. The choice is not stored as a future policy. The administrator does not choose a new date or enter schedule times for requested-date rows. A stale request revision or invalid due date rejects the batch. Legacy requests with unknown requested-day lists retain manual event-day scheduling; opening legacy days, moving a day, and reopening staffing use the same 1–4-day choice. Requested dates, saved times, acceptance, open staffing, or assignments do not reserve a date or confirm a booking. Guest count and preferred venue remain follow-up details; the API also accepts an optional guest count.

Creation snapshots the package name, price, and maximum guests. Later catalog edits do not change those snapshots. A supplied stale `packageUpdatedAt` returns `409`. Requests start as `under_review`; other statuses are `needs_details`, `accepted`, `declined`, and `cancelled`. Acceptance is for processing only. Customers can cancel their own open requests. Only System Administrators can update review status; the API permits staff to read requests, but the current staff workspace does not display that queue. Preferred location is independent of the venue catalog.

Both message workspaces refresh every five seconds. Opening a conversation marks the other side's messages as read; messages allow up to 4,000 characters. Customers open request details from linked customer conversations in a modal and can enter times for their eligible unscheduled days. From a linked conversation in the admin Messages workspace, the info icon opens `/app/bookings/{id}`, where request review and event-day controls live. Conversations have no automatic expiry. Booking-linked threads stay active regardless of their age, parent end time, or message activity. An expiry policy is deferred for future bookingless conversations; the existing general-chat routes also have no timer. Existing closed threads retain their status; a customer message can reopen a general conversation, while a closed booking-linked thread remains read-only. Closed history is retained. There is no public guest chat or AI assistant.

### Private packages and quotations

The inquiry retains its original catalog `package_id` and name, price and guest-limit snapshots. Its current proposal is the private package identified by `custom_for_booking_request_id`, falling back to the original catalog record when no custom package exists. Admins select a catalog base, copy its content and uploads independently, and edit that booking’s custom package thereafter. Private packages are excluded from public catalogs, public slugs and new inquiry selection. Catalog title/address behavior is preserved; private copies may retain the same title.

From the admin booking page, System Administrators create a quotation draft from the current proposal, save ordered manual additions/deductions, and send the saved version. Empty adjustment lists are valid. The server validates every item and optional service reference and atomically saves JSONB items with the computed integer-centavo total. Each version retains its package ID, base amount, adjustments and computed total. Package content, services and event details remain on the booking and current proposal; quotations do not copy or automatically compare them. Later edits do not change saved quotation amounts or block sending. An administrator explicitly starts a revision when a new offer is needed; the revision uses the current proposal price and copies prior adjustments for review.

Sending atomically records the quotation, audit event and a version-linked conversation message. A closed linked conversation blocks sending; sending does not reopen it. Quotations have no automatic expiry. Any System Administrator can edit, revise or send, with audit attribution. Starting a revision immediately supersedes the prior offer and creates an internal draft for adjustment review. Customers see sent history and discuss agreement, concerns, or requests for a new quotation through chat. Customer replies do not change quotation status or create drafts. Internal drafts remain hidden. Existing accepted quotations and their timestamps remain readable as historical records and can still be revised by an administrator; there is no customer quotation acceptance or revision endpoint. Quotations and chat replies do not confirm a booking, reserve dates, or create event days.

The additive `20261111130000_private_packages_quotations` migration creates service links, JSONB quotations and audit events, adds private ownership and message references, and applies constraints, RLS and restricted grants. It does not replay err12’s booking simplification or remove inquiry snapshots/timezones. The follow-up `20261111150000_simplify_quotation_offers` migration removes the package timestamp and full terms snapshot from quotations while retaining financial values, version/status history, audit events and message links. Apply pending migrations to the intended database before using these screens; generating types or passing tests against disposable databases does not migrate an application database.

### Day-based event staffing

An accepted booking request can have multiple event days, each with its own date, full start/end timestamps, staffing opening, response deadline, and team. Times use the booking's timezone and may run overnight. Event-day status is `scheduled`, `cancelled`, or `moved`; staffing status is `draft`, `open`, or `closed`. Reopening staffing uses the existing day and a 1–4-calendar-day deadline choice. The request-level Apply deadlines action uses one such choice across ready requested dates and current scheduled event days; each cutoff is the end of the calculated local date in the booking timezone. It leaves closed windows closed and moved or cancelled history untouched. Unscheduled dates without saved customer times are skipped and require applying the choice again after times are saved; no deadline policy is saved for future dates. Legacy manual creation, movement, and reopening also accept the bounded day choice instead of a raw deadline instant.

Staff respond `available` or `unavailable` while responses are open and before the deadline. No response remains distinct from unavailable. A confirmed assignment on that same event day blocks another available response; a cancelled assignment allows it. After responses close, a System Administrator selects available staff as coordinator or helper. Confirmation checks overlapping assignments across full timestamp ranges, and each day allows at most one confirmed coordinator. Availability and assignments remain separate, with one record per staff member and event day in each table.

The staff calendar counts operational event-day dates in the staff member's accessible list, including retained cancellation and movement history. Selecting a date filters the table; search and All/Open/Responded filters can narrow it further. Assigned to me retains cancelled assignments alongside confirmed ones. Both screens refresh on return to the window and every minute; availability controls also close when the deadline passes. Availability controls show saving, saved, and failure feedback beside the affected day in both the table and details drawer; the selected response changes only after a successful API save. Their shared details drawer shows the parent booking reference and package, event, schedule, timezone, status, response deadline, own response and assignment, and confirmed team. Responding unavailable does not cancel an existing assignment. Admin bookings and staff Event days use the shared `MonthCalendar` presentation from `packages/ui`, with separate data sources: each requested date for new inquiries (the recorded preferred date for legacy requests) and actual operational event-day dates for staff. Requested dates without operational schedules do not become staff openings or assignments.

Cancelling a day closes staffing and cancels its assignments. Cancelling the parent booking request also cancels all its scheduled days and confirmed assignments in the same transaction. Moving it creates a replacement under the same booking with empty responses and assignments; the original is marked moved, linked to its replacement, and retained with cancelled assignments. Staff must respond and be selected again. Accepting a request and confirming staff assignments do not confirm the booking or reserve its date.

### Coordinator checklists

On `/app/bookings/{id}`, open the **Checklist** tab and choose an operational day from the same date-and-status strip used in Details. This tab contains draft creation, title/task editing, ordering, progress and send controls. Details keeps scheduling and team assignment controls. Only System Administrators can read an unsent draft, edit its title, or send it. Sending requires a scheduled day on an accepted request, a confirmed coordinator, and at least one task. It grants immediate in-app access: there is no acceptance action or state, and no external notification is sent. The coordinator opens the day's details from Assigned to me at `/app/assignments`.

Both the admin and the current recipient can edit every task detail, add/delete tasks (including the last), and change their display order. Each task has its own date, start time and duration in the booking timezone; the date dropdown shows five scrollable long-format dates, initially centered on the event day. There are no task groups. The API saves full offset-bearing start/end instants rather than separate display date/time/duration fields. New tasks start pending with an empty progress note; the creation form asks only for the name, schedule and instructions. Saved tasks expose status and progress notes when edited, and sent tasks have direct completion/reopen controls. Reorder and delete actions sit under each task’s More actions menu. Pending, blocked and completed are task states; blocked tasks require a note. Completion records server time in `completedAt`, and reopening clears it. No `completedBy` is stored. Overall completion/overdue counts appear after sending and are derived; an empty checklist is not complete.

`event_checklists` contains one current JSONB `{ tasks: [...] }` document per event day. Stable task IDs and completion timestamps are server-owned. Reads and writes recheck the confirmed assignment and saved recipient under booking → event-day → checklist locks. Mutations and sends require `expectedRevision`; stale saves return `409` without overwriting changes. The UI keeps the failed edit and requires an explicit reload before continuing. Admins can read retained checklists after a day ends, while writes require a scheduled day and accepted request.

Cancelling, demoting, replacing or reconfirming the coordinator clears delivery metadata and advances the checklist revision atomically with the assignment write, even for the same user and assignment row. Day cancellation/movement and customer/admin request cancellation also invalidate delivery in their existing transactions. Tasks remain in an admin-only draft until explicitly sent again; replacement days start without a checklist. This table retains the current document, not deleted tasks or a complete edit/send history. Checklist progress does not confirm or complete a booking.

The additive `20261113120000_event_checklists` migration adds the table, JSONB validation, indexes, RLS and restricted direct-client grants. Apply it to the intended application database before using these screens. `pnpm --filter @event-management/api test:event-days` verifies checklist and staffing behavior against a disposable migrated PostgreSQL database; it does not migrate the configured or hosted database.

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

Astro runs as a Node server. Public pages under `apps/web/src/pages` are rendered on each request. `/login` and `/app/*` mount `components/app/App.tsx` with `client:only="react"`. The app keeps its React and authentication providers mounted while same-origin `/app` navigation updates the URL with the History API; public and login routes remain document navigations. `GET /me` chooses the admin, staff, or customer shell, and each role keeps only its own `/app` paths. Shared UI uses atomic layers and exports from `packages/ui/src/index.ts`. Theme tokens live in `packages/theme/src/theme.css`; app styles live in `apps/web/src/styles/`.

API routes are mounted under `/v1` in `apps/api/src/app.ts`. HTTP contracts and handlers belong in `controllers/<domain>/`, business operations in `services/<domain>/`, and Kysely queries in `data/<domain>/`. Shared helpers belong in `utils/`. The running API exposes its OpenAPI contract at `/openapi.json`.

## Local development

Requires Node.js 22.22+, pnpm (the version is pinned in `package.json`), and Docker with Docker Compose.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the local Supabase stack, serves the edge function, and starts the website at <http://localhost:4321/>. `pnpm all` remains the Compose PostgreSQL path: it creates `apps/api/.env` from its example if missing, starts PostgreSQL and waits for its healthcheck, applies committed migrations, then starts the Node API and web servers. Local email/password sign-in works without Firebase configuration. Catalog uploads use the private Supabase Storage bucket `event-management`; object keys stay `catalog-media/<id>`. The edge runtime supplies its own Storage URL and service role. The Node API needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the API example.

**Existing databases:** review pending migrations and back up affected data before `pnpm all`, `pnpm dev:prepare`, or `pnpm db:deploy`; these commands apply migrations. See [migration impact](#migration-impact).

| Service | Local URL |
| --- | --- |
| Website and workspaces | <http://localhost:4321/> |
| Edge function health, from `pnpm dev` | <http://127.0.0.1:54321/functions/v1/api/v1/health> |
| Node API health, from `pnpm all` | <http://localhost:3000/v1/health> |
| Node OpenAPI, from `pnpm all` | <http://localhost:3000/openapi.json> |
| Storybook, when started | <http://localhost:6006/> |

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local Supabase stack, serve the edge function, and run the website |
| `pnpm all` | Start Compose PostgreSQL, apply migrations, and run the Node API and web |
| `pnpm all:storybook` | Start the Compose stack, Node API, web, and Storybook |
| `pnpm all:web` | Run only the frontend |
| `pnpm dev:prepare` | Prepare PostgreSQL and apply migrations |
| `pnpm storybook` | Run only Storybook |
| `pnpm db:up` / `pnpm db:down` | Start / stop PostgreSQL; stopping retains its volume |
| `pnpm db:seed` | Insert local fixtures, sample catalog data, and the interconnected scenario |
| `pnpm supabase:start` / `pnpm supabase:stop` | Start / stop the local Supabase stack in `apps/supabase` |
| `pnpm supabase:status` | Show local Supabase URLs |
| `pnpm agents:sync` | Sync additions across `.agents`, `.agent`, `.claude`, and `.cursor` |

`pnpm agents:sync` runs once and copies missing entries from any of the four folders into the others, including hidden files, subfolders, and symbolic links. It creates missing folders and preserves existing files. Conflicting contents or entry types at the same relative path are reported and skipped, including descendants of conflicting paths; the command exits with status 1 after syncing unambiguous additions. It does not propagate edits or deletions: a file removed from one folder is restored from another on the next run. Rerun it after adding files to any folder.

`Ctrl+C` in `pnpm all` stops the Node API and website; Compose PostgreSQL stays running until `pnpm db:down`. The seed is separate from startup and does not overwrite catalog edits or archives. See [database seed](docs/SEED.md) for coverage, collisions, and verification. Sample content and prices are not business-approved offers.

### Local Supabase

`apps/supabase` is the local Supabase CLI project, pinned to CLI 3.0.0. `pnpm supabase:start` requires Docker and starts its own Postgres 17, Studio, and Storage. Postgres listens on `127.0.0.1:54322`, the API gateway on `54321`, and Studio on `54323`. This stack can run beside `pnpm db:up`. Local Storage declares the private `event-management` bucket in `apps/supabase/config.toml`. Restart the stack after pulling that bucket so Storage creates it. New catalog objects use the key `catalog-media/<id>`; this change does not copy objects already stored elsewhere.

The Node API, Prisma, seeds, and integration tests still use Compose PostgreSQL from `apps/api/compose.yaml` on port 5432. Do not point that API's `DB_HOST` at the Supabase database until that cutover is explicit. Supabase Auth is not the application sign-in.

`pnpm dev` starts this stack when it is not already running, bundles the Hono routers into one Edge Function at `apps/supabase/functions/api`, and serves that function with the website. A request loads only the matching route family. The browser calls the website origin at `/v1`. The Astro dev server proxies that path to `http://127.0.0.1:54321/functions/v1/api`. The Supabase gateway sends `Access-Control-Allow-Origin: *` and answers preflight itself; browsers reject that header when a request includes the session cookie, so the page does not call the gateway directly. Direct checks, such as the health URL in the service table, can still use the gateway. The function reads `apps/supabase/.env.functions`, which `pnpm dev` creates when missing. Inside the function container the database host is `db` on port `5432`. That host is the Supabase database, not Compose. The local edge runtime uses `oneshot` mode so a bundle rebuild does not hot-reload the container. Restart `pnpm dev` after `pnpm build:edge` to load a new bundle. If the function server exits, `pnpm dev` starts it again and leaves the website running. `Ctrl+C` stops both; the Supabase stack stays up until `pnpm supabase:stop`.

### Configuration

Use the checked-in [API environment example](apps/api/.env.example) and [web environment example](apps/web/.env.example) for variable names. Keep `.env`, `.secrets/`, database values, session tokens, and service-account contents out of chat and commits.

- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` configure the API, Prisma, and type generator. A separate `DATABASE_URL` is unnecessary. Compose reads `apps/api/.env`; its project name remains `event_management_v2` to reuse the existing volume.
- Browser API: `PUBLIC_API_URL` points to the API including `/v1`. `pnpm dev` sets it to `/v1` on the website origin. `pnpm all` uses the web environment value, which defaults to `http://localhost:3000/v1`.
- Catalog media: set the Supabase Storage variables in the API example before testing Node API uploads. Built-in package sample photos do not require uploads. Existing stored files are left in place.
- Database clients such as DBeaver: use PostgreSQL on `localhost:5432` with the configured database name/user/password. The local defaults use no SSL. A containerized client may require `host.docker.internal` instead of `localhost`.

## Authentication

New registrations create local customer accounts with Argon2id password hashes; passwords must contain 8–128 characters. Password hashing uses WebAssembly through `hash-wasm` in both Node and the Edge Function, with 19 MiB of memory, two passes, and parallelism one. Existing Argon2id hashes remain valid; no password reset or database migration is needed. Google sign-in and existing Firebase email/password accounts are optional identity methods. Application roles always come from PostgreSQL.

Run `pnpm --filter @event-management/api test:password` for password compatibility checks. With the current Edge bundle served by `pnpm dev` or `pnpm dev:edge`, run `pnpm --filter @event-management/api test:edge` to check session rejection, unknown-account password verification, route matching, and OpenAPI loading in the local runtime. After changing API code, rebuild with `pnpm build:edge` and restart the function server before running those runtime checks.

All methods use the `em_session` cookie and hashed sessions in PostgreSQL. The frontend restores the account with `GET /v1/me`. While the workspace remains open, it rechecks `/me` when the page regains focus or visibility and after a non-authentication data request returns `401`. A successful check refreshes the profile; a `401` clears it and returns the user to login with the local workspace URL saved for sign-in. Same-origin `/app` navigation uses browser history and does not remount the authentication provider. Sessions expire after `SESSION_TTL_DAYS` (default 7), rotate on successful sign-in/linking, and are deleted on logout. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

Account settings → Sign-in methods supports connecting Firebase to a local account after proving the current local password, or adding a local password after proving the connected Firebase identity. Firebase proof requires a verified email and a sign-in within five minutes. Matching emails never merge accounts automatically; linking preserves the database identity and role. Profile editing, local password reset, and local email-verification delivery are not implemented.

System Administrator access requires both database role `admin` and staff title `System Administrator`. This permits catalog administration, directory reads, admin messages, and request-status updates. Staff cannot perform these writes. Reload after changing database roles so the frontend refreshes its profile.

Password attempts are limited in memory per account; multiple API processes require a shared limiter. Browser writes must pass the configured `WEB_ORIGIN` check. See the [authentication reference](context-factory/api/reference/auth-and-sessions.md) and running OpenAPI contract for route details.

### Optional Firebase setup

1. Enable Google and retain Email/Password for existing accounts in Firebase Authentication. Add `localhost` to authorized domains for local development.
2. Fill in the `PUBLIC_FIREBASE_*` fields in `apps/web/.env` using the web app configuration.
3. Configure `FIREBASE_PROJECT_ID` on the API and either `GOOGLE_APPLICATION_CREDENTIALS` pointing to a gitignored service-account JSON or `FIREBASE_CLIENT_EMAIL` plus `FIREBASE_PRIVATE_KEY`. Relative credential paths resolve from `apps/api`.
4. For a Firebase-backed admin, run `pnpm db:seed-admin admin@example.com` after configuring Firebase. The command finds the Firebase user or creates one when `ADMIN_PASSWORD` is supplied, then assigns the database System Administrator role. For local-only fixtures, use `pnpm db:seed` instead.

The API verifies Firebase ID tokens, including revocation/disabled-user checks, before identity exchange or linking. A Firebase token alone does not grant catalog administration.

## Catalogs and media

Catalog packages, services, and venues are flat records, each with one canvas page. A System Administrator catalog save publishes a complete record immediately. Packages can include ordered service links marked included or optional; these links do not calculate price or establish availability. Venues remain independent. Booking-owned custom packages are private and have a separate edit/audit flow. Updates require `expectedUpdatedAt`; stale or archived edits return `409`. Archive hides a record from public selection. A package referenced by a booking request cannot be deleted.

| Catalog | Required save data |
| --- | --- |
| Package | Name, positive `maxGuests`, fixed total PHP price, and canvas sections; the catalog description is separate from Markdown widgets |
| Service | Name, description, positive whole-peso `hourlyRatePesos`, and a canvas photo |
| Venue | Name, location, description, and positive `maxGuests`; canvas photos are optional |

Package prices are stored as whole pesos; the API uses `{ kind: "fixed", currency: "PHP", amountMinor }` in centavos divisible by 100. Booking snapshots use `packageName`, `packagePrice`, and `packageMaxGuests`. Migrated service rates and venue guest limits may be null on reads; saves enforce complete current input. Omitted service/venue canvas sections preserve saved content.

The shared editor uses photo, Markdown, and video widgets on a 12-column canvas. The editor, customer preview, and public detail page use the full available width with the same widget dimensions at the same screen width. Photos and videos fit inside their widgets without cropping; rendered text outside a widget is clipped without internal scrollbars. Markdown editing opens in a separate dialog so the canvas shows the rendered result. Editor guides and numbered columns use the actual snap geometry; each section shows its automatically growing row count from the lowest widget edge. Saves retain widget positions and spans, including intentional gaps. A widget can span at most 100 rows; sections have no separate fixed row count. Editor previews, saved catalog overlays, booking package views, and server-rendered public details reuse the same app composition and shared canvas/widget renderer; embedded booking views adapt to their containing area. Media uploads go through `POST /v1/admin/catalog-media`, remain pending until a catalog save references them, and stream through `/v1/catalog-media/{id}`. JPEG/PNG/WebP images allow up to 10 MiB; MP4/WebM videos allow up to 25 MiB. Photo/video widgets accept uploads only, with built-in sample photos retained for seeded packages; external URLs and hosted-player embeds are rejected. Video autoplay is opt-in and uses muted inline playback on customer previews and public pages.

Public media streaming requires a reference from a published, non-archived catalog record. System Administrators can preview pending uploads and saved private media under the API access rules. Owners can preview media currently referenced by their private package; private responses use no-store caching. Quotations do not retain historical media or grant media access. Removing uploaded media triggers cleanup only when no current widget references it; storage failures can leave unreferenced assets for retry. See [catalog media](context-factory/api/reference/external-image-urls.md) for storage, cleanup, and migration details, and [shared limits](context-factory/limits/SKILL.md) for validation ownership.

## Database workflow

For schema changes, edit `apps/api/prisma/schema.prisma`, create and review the migration, then regenerate Kysely types:

```sh
pnpm db:migrate
pnpm db:generate
pnpm check
```

`pnpm db:deploy` applies committed migrations; it does not create migrations. Never hand-edit generated `apps/api/src/db/types.ts`. Inspect both Prisma and SQL migrations because some database constraints extend beyond the Prisma model.

The type generator includes application tables in `public` only, excluding Supabase's internal schemas. Migration `20261110141853_event_day_staffing` adds `events_day`, `event_staff_availability`, and `event_staffs` without backfilling existing bookings or staff; the API owns deadlines, eligibility, timezone validation, overlap checks, and transactional movement/cancellation.

Migration `20261109140000_enable_application_rls` enables row-level security on application tables and Prisma's migration history. It removes table grants from `PUBLIC` and, when present, Supabase's `anon` and `authenticated` roles. Clients access records through Clemora's session-aware API; there are no direct-client RLS policies. The server database role must own the tables or have `BYPASSRLS`. Future table-creation migrations must explicitly enable RLS and remove unused client grants too; this migration does not install an automatic trigger. These SQL-only access settings do not change Prisma models or generated Kysely types.

Migration `20261111150000_simplify_quotation_offers` deliberately discards quotation package timestamps and full package/event-term snapshots. It preserves quotation IDs, package references, amounts/items, status and acceptance timestamps, revision links, audit events, and quotation messages. It does not delete Storage objects; normal cleanup can remove uploads that no current widget references. Deploy the matching API and web changes together with this migration.

Migration `20261111120000_booking_requested_days` adds nullable JSONB `booking_requests.requested_days` with a check that non-NULL values are nonempty arrays. SQL `NULL` identifies requests created before customers selected a complete date list. The migration does not backfill dates or rewrite the legacy estimate, timestamps, snapshots, conversations, or operational event days.

**`pnpm db:reset` deletes data without a confirmation prompt.** Its script forces a Prisma reset, reapplies migrations, and seeds the configured database. Check the target and use it only for a database whose contents may be discarded.

### Migration impact

Review all pending migrations before upgrading a populated database:

- `20261102130000_package_canvas` removes existing packages, package versions and service assignments, booking requests and status history, and booking-linked conversations/messages. General conversations and messages remain.
- `20261102180000_flat_services_venues` retains selected current content, or archives the latest content when none was published. It removes version tables and unselected canvas pages; uploaded storage objects are not deleted.
- `20261102190000_cleanup_catalog_fields` renames guest limits to `maxGuests` / `max_guests` and snapshots to `packageMaxGuests` / `package_max_guests`. It discards package event types, venue categories/photo URLs, and legacy service-image references. Existing canvas content and inquiry snapshots remain. Legacy storage objects are not removed remotely.
- `20261109140000_enable_application_rls` preserves records and blocks direct table access for Supabase client roles. Apply it as the table owner and verify the API database role before deployment. `pnpm db:deploy` targets the database configured for the API; creating this migration does not apply it to the separate local Supabase stack.
- `20261111120000_booking_requested_days` adds the nullable requested-date JSONB column and array constraint without fabricating missing dates or rewriting existing booking data.

Back up affected records before deployment. Apply coordinated API/frontend contract changes with their migrations; do not edit applied migrations or reset a database to resolve drift. The [database guidance](context-factory/api/reference/database-and-migrations.md), [catalog media reference](context-factory/api/reference/external-image-urls.md), and [seed guide](docs/SEED.md) provide the related procedures.

## Verification

Run the checks matching the changed area:

| Command | Checks |
| --- | --- |
| `pnpm check` | Workspace types |
| `pnpm check:design` | Web controls use shared UI exports; authored web/UI colors use theme tokens. Source checks do not establish visual or behavioral correctness. |
| `pnpm build` | Web production bundle and API types |
| `pnpm build:storybook` | Shared UI rendering build |
| `pnpm db:validate` | Prisma schema |
| `pnpm check:guidance` | Context-factory links, anchors, skill metadata, registration, and reachability; does not verify agent compliance or application behavior |
| `pnpm --filter @event-management/api test:auth` | Authentication and sessions with PostgreSQL and Firebase Auth emulator |
| `pnpm --filter @event-management/api test:packages` | Package/service catalog and shared canvas behavior |
| `pnpm --filter @event-management/api test:venues` | Venue catalog behavior |
| `pnpm --filter @event-management/api test:booking-requests` | Inquiry creation and legacy preservation; requested-date validation, per-day time saves, stale writes, calendar counts, status filters, and duplicate-free pagination |
| `pnpm --filter @event-management/api test:event-days` | Day staffing, availability, assignments, deadlines, permissions, overlap protection, requested-day scheduling links, and movement/cancellation |
| `pnpm --filter @event-management/api test:quotations` | Quotation lifecycle, JSONB amounts, permissions, stale writes and atomic conversation delivery |
| `pnpm --filter @event-management/api test:proposal-migration` | Populated baseline preservation, ownership, JSONB arithmetic, message linkage and RLS/grants |
| `pnpm --filter @event-management/api test:messages` | Conversation ownership, messages, read state, and no automatic expiry |

Integration suites create disposable local PostgreSQL databases and require permission to create them. Auth also requires the Firebase CLI on `PATH` and ports 9099, 4409, and 4509 free; it uses an emulator rather than production Firebase. Media tests use a local Storage API fake rather than production Supabase Storage. See [API verification](context-factory/api/reference/verification.md) and the [seed guide](docs/SEED.md) for additional focused suites.

A passing build does not establish browser, persistence, or production-provider behavior. Verify affected customer/staff flows, permissions, reloads, and failure paths at the appropriate boundaries.

## Reference material

- [Database seed](docs/SEED.md): fixtures, sample records, rerun behavior, and verification.
- [Prevail interview summary](docs/PREVAIL_INTERVIEW_SUMMARY.md): timestamped findings and separate later scope decisions.
- [Full transcription](transcriptions/full-transcription.md), [Video 1](transcriptions/video-1.md), and [Video 2](transcriptions/video-2.md): preserved interview source text.
- [Repository guidance](AGENTS.md), [context factory](context-factory/README.md), and [agent index](context-factory/agents/README.md): contributor ownership, engineering/shared skills, documentation workflows, and QA guidance.
