# Clemora

Clemora is the event-management product for **Prevail Events Management**. This pnpm workspace contains an Astro/React frontend, Hono OpenAPI backend, and shared UI, theme, and contract packages. PostgreSQL stores application records; Prisma owns schema changes and migrations, and Kysely handles runtime SQL.

This README owns product scope, current implementation status, and development setup. The [interview summary](docs/PREVAIL_INTERVIEW_SUMMARY.md) records client evidence and distinguishes it from later scope decisions. The [seed guide](docs/SEED.md) covers development fixtures and repeat runs.

## Product scope

Scope recorded on 2026-11-03:

| Area | Intended behavior |
| --- | --- |
| Catalogs | Present packages, services, and venues with administrator-managed content. |
| Inquiries and quotations | Let customers start from a package or describe requirements first. Staff collect missing details, prepare custom quotations, issue revisions, and retain quotation history. Changes affecting an agreed price or delivery require customer reapproval. |
| Availability and booking | Let staff check availability, control confirmation, and record event changes. Define date holds, exclusive periods, setup/cleanup buffers, and cancellation rules; prevent conflicting confirmations, including simultaneous attempts. |
| Event preparation and workforce | Maintain event details, staff profiles and availability, manager-assigned teams, schedules, tasks/checklists, progress, operational concerns, and notifications. |
| Customer service | Use AI for factual answers from approved information, inquiry collection, and human handoff. Staff retain quotation and commitment decisions. |
| Reports and past events | Report on actual business records and maintain a managed past-events showcase with publication permissions. |
| Access and communication | Give customers access to their own inquiries and conversations, and staff access appropriate to their roles. |

A request does not reserve a date, establish a final price, or confirm a booking. Confirmation rules remain to be agreed and must not be inferred from payment.

**Outside scope:** all payment responsibilities, including gateways, proof uploads, verification, payment records/status, balances, fee calculation or crediting, and receipts; equipment/inventory management; and supplier management or coordination. Existing demo screens do not establish requirements.

**Later work:** custom package/service combination configuration, menus, policies, terms, and AI knowledge maintenance. The staff delivery platform is undecided.

Before implementing dependent work, confirm intake fields and real catalog content/prices; quotation format, approvals and revisions; availability, confirmation, cancellation and event-change rules; workforce permissions and notifications; assistant sources and handoff ownership; and report/showcase definitions. Meta and other channel integrations require separate decisions.

### Staff mobile findings — issue #14

The product discussion for [issue #14](https://github.com/XerojUlgasan/event-management/issues/14) narrows the first release to two connected features below. These are intended requirements, not implemented behavior or a completed client validation exercise. The delivery platform remains undecided; the first release requires an internet connection.

#### Access and page map

Staff register without an approval step. Only an administrator can grant coordinator access; registration must not grant that privilege. All active staff, including coordinators and head waiters, use **Upcoming Events & Availability**. Coordinators additionally see a separate **Event Timeline & Checklist** page and can update only events assigned to them. Administrators manage events and teams and monitor progress on the website.

Keep sign-in, session restoration, and sign-out as supporting flows. Merge event details and the published roster into Upcoming Events & Availability. Merge assigned-event selection and task progress into Event Timeline & Checklist. Separate Home/Today, calendar, notifications, chat, and expanded profile/settings pages are deferred to keep the first release small.

#### Upcoming Events & Availability

- Admin posts an event with its date, time, general location, response deadline, and tentative/confirmed status. Availability can be requested while an event is tentative; it does not reserve a date or confirm a booking.
- Staff respond **Available** or **Unavailable**, with one current response per person per event. They can change it until the deadline. Show unanswered events first, the saved response, and a retry option when saving fails.
- Admin reviews **Available**, **Unavailable**, and **No response** separately. No response does not mean unavailable.
- Admin manually selects a team from available voters, assigns the coordinator and other event roles, and publishes the finalized roster. Draft selections remain private. Staff see **Team selection pending** before publication, then their selected/not-selected status and an Event Team section after publication.
- A vote does not establish an assignment. The published coordinator assignment connects the event to that coordinator's checklist page.
- Date or time changes require fresh responses; old responses must not count as current availability. Cancelled events stop accepting votes. A selected person's later unavailability is flagged for admin review rather than silently removing the assignment; admin selects a replacement and publishes the updated team.

#### Event Timeline & Checklist

- Admin prepares an event-specific copy of a reusable checklist template. Adjusting that copy must not change the template or another event. The coordinator can tailor the event checklist before the event; detailed editing permissions remain to be finalized.
- Activities appear in order, with optional planned times and **To do**, **Done**, or **Blocked** statuses. Only the assigned coordinator records progress. Completion records the actual time; a blocker includes a short explanation. Accidental completion can be corrected with a recorded update history.
- The coordinator can add notes and optional photos from the camera or gallery to an item. Admin views them beside its status. A photo can document either completion or a problem; uploading it does not mark the item Done.
- Admin sees progress counts, blockers, notes, photos, and the latest received update time. Saves and uploads must distinguish pending, successful, and failed attempts and offer retry without falsely reporting success.
- **Event finished** means the event itself has ended. **Closeout complete** means the remaining required checklist work is finished. Closeout does not introduce payment tracking or processing.
- Show explicit loading, empty, and failed-load states, including **No assigned events yet**. Missing assignment or coordinator access must deny updates on the server as well as hide controls. Reassignment must remove the previous coordinator's update access; account deactivation must prevent further access.

Candidate template items are examples to tailor, not a requirement to use every item:

| Stage | Possible checklist items |
| --- | --- |
| Preparation and packing | Review the event brief; check team attendance; brief responsibilities; confirm supplies packed; complete a departure check. |
| Travel and arrival | Record departure and arrival; check the setup area; confirm unloading is complete. |
| Venue setup | Arrange tables and chairs; place linens and decorations; prepare applicable service areas; clear walkways and setup waste. |
| Final readiness | Check the setup against the approved plan; confirm cleanliness and staff readiness; record unresolved problems. |
| Event proper | Record event start; track relevant program/service milestones; note operational problems; record event finish. |
| Cleanup and closeout | Clear work areas; confirm packing and return activities; record unresolved concerns; review unfinished items; complete closeout. |

Packing/return items are manual operational confirmations, not inventory records, stock reconciliation, or supplier coordination. Photos can support a relevant item but are not mandatory evidence for every completion. Photo count, size, formats, retention, and compression are still to be specified; the suggested three-photo cap was not finalized.

#### Connected admin workflow

One event workspace on the website connects **Event Details**, **Availability & Team**, and **Timeline & Checklist**. Admin creates the event, collects responses, selects and publishes the roster, prepares the checklist, and follows the coordinator's updates. Admin controls setup and team publication; the assigned coordinator controls progress updates.

The intended journey is: post event → staff respond → admin publishes team → coordinator updates checklist and optional photos → admin monitors → event finishes → closeout completes. Rescheduling, cancellation, withdrawal, and reassignment must preserve a comprehensible history rather than silently overwriting decisions.

#### Implementation gaps and follow-up work

Source inspection found the current [staff workspace](apps/web/src/components/app/StaffWorkspace.tsx) still provides booking-request and catalog views. [Local registration](apps/api/src/data/auth/create-local-user.ts) creates customer accounts. The [schema](apps/api/prisma/schema.prisma) and [route registration](apps/api/src/app.ts) do not yet provide these event, availability, team, or checklist workflows. Existing identity/session infrastructure can support further work, but staff registration and administrator-controlled coordinator assignment need new behavior. Catalog media support is not an authorization contract for private event photos.

Suggested follow-up work, not yet created as implementation tickets:

1. Define event records and lifecycle independently from inquiry acceptance, plus staff registration and coordinator-role management.
2. Deliver event posting, availability responses/deadlines, and admin response review.
3. Deliver draft team selection, publication, replacement, and assignment-based access.
4. Deliver event checklist templates/copies, progress, notes, history, and admin visibility.
5. Deliver authorized checklist photo uploads, reads, failure handling, and agreed retention/limits.

Dependencies follow that order except photo work can be designed alongside checklist work. Validate each slice with server-side permission, persistence, and failure-path checks before treating it as implemented.

#### Deferred features and unresolved decisions

Automatic team generation, role-specific shifts, assignment acknowledgment, push notifications, offline support, and a separate chat are outside this first release. Payment responsibilities, inventory management, and supplier management/coordination remain outside product scope. Admin-help flags/replies, photo limits, extra task controls, automatic timeline shifts, reminders, contact shortcuts, and other suggested enhancements are not approved additions.

Before implementation, settle who can view the full published roster and event photos; template editing and closeout/reopening authority; withdrawal after the voting deadline; how previously published teams behave during rescheduling/cancellation; access to completed events after reassignment; and whether tentative events can have a published final team. The response-reset rule is agreed, but it does not resolve these team-state transitions.

Device/browser evidence and a mobile web/PWA/native comparison are still needed. No stakeholder walkthrough, prototype validation, platform experiment, or runtime validation of these new workflows was performed for this summary. Issue #14 remains open: this records the product findings and known gaps, not completion of all spike acceptance criteria. Historical interview records remain unchanged.

## Current implementation

| Area | Implemented boundary |
| --- | --- |
| Website and catalogs | `/` shows packages, services, and venues in that order. View more opens paged catalog overlays; cards open detail previews. All three catalogs persist in PostgreSQL and support direct saves, canvas content, and archives. |
| Identity | Local email/password and optional Firebase sign-in share database profiles, roles, and server-side sessions. |
| Booking requests | Signed-in customers submit inquiries from published packages. PostgreSQL stores package snapshots, request details, status history, and a linked conversation. Signed-out drafts resume after sign-in for explicit review and submission. |
| Messages | Customer-to-admin conversations persist in PostgreSQL, including request-linked conversations, unread counts, and read state. |
| Directory and staff access | System Administrators have a read-only Staff & Customers directory. Ordinary staff have read-only booking requests and published package/service views. |
| Remaining scope | Requirements-first inquiries, quotations, availability, confirmed bookings, full workforce management, AI replies/handoff, reports, and the managed showcase are not implemented. Other business screens may contain demo or local data. |

### Booking requests and messages

The current intake requires a customer session and a published package. It collects event type (Birthday, Wedding, Corporate, or a custom choice), preferred date, estimated event length, contact name and phone, and optional notes. Length can be one through six days, one week, more than one week with an exact day count, or unspecified. Guest count, exact times, and venue/location are gathered in follow-up; the API also accepts an optional guest count.

Creation snapshots the package name, price, and maximum guests. Later catalog edits do not change those snapshots. A supplied stale `packageUpdatedAt` returns `409`. Requests start as `under_review`; other statuses are `needs_details`, `accepted`, `declined`, and `cancelled`. Acceptance is for processing only. Customers can cancel their own open requests. Only System Administrators can update review status; ordinary staff can read requests. Preferred location is independent of the venue catalog.

Both message workspaces refresh every five seconds. Opening a conversation marks the other side's messages as read; messages allow up to 4,000 characters. Request-linked threads expose booking details, read-only for customers. Conversations expire 24 hours after the event end when known, or 24 hours after creation otherwise. Expired linked threads remain closed; a customer message can reopen a general conversation. Closed history is retained. There is no public guest chat or AI assistant.

## Workspace layout

```text
apps/
  web/                 Astro host, React screens, client auth and API calls
  api/                 Hono controllers, services, data queries, Prisma and tests
    compose.yaml       Local PostgreSQL service
packages/
  contracts/           Shared field, file and collection limits
  theme/               Design tokens and CSS variables
  ui/                  Shared React components and Storybook
scripts/               Development startup
context-factory/       Contributor guides, agent workflows and QA helpers
docs/                  Seed guide and interview summary
transcriptions/        Individual and combined interview transcripts
```

Astro serves the HTML shell in `apps/web/src/pages/index.astro` and provides frontend development and build tooling. The shell mounts `components/app/App.tsx`; React owns the application screens, authentication state, and in-page view switching. Shared UI uses atomic layers and exports from `packages/ui/src/index.ts`. Theme tokens live in `packages/theme/src/theme.css`; app styles live in `apps/web/src/styles/`.

API routes are mounted under `/v1` in `apps/api/src/app.ts`. HTTP contracts and handlers belong in `controllers/<domain>/`, business operations in `services/<domain>/`, and Kysely queries in `data/<domain>/`. Shared helpers belong in `utils/`. The running API exposes its OpenAPI contract at `/openapi.json`.

## Local development

Requires Node.js 22.22+, pnpm (the version is pinned in `package.json`), and Docker with Docker Compose.

```sh
pnpm install
cp apps/web/.env.example apps/web/.env
pnpm all
```

Copy the web environment file only when it does not already exist. `pnpm all` creates `apps/api/.env` from its example if missing, starts PostgreSQL and waits for its healthcheck, applies committed migrations, then starts the API and web servers. Local email/password sign-in works without Firebase configuration. Catalog uploads require R2 configuration.

**Existing databases:** review pending migrations and back up affected data before `pnpm all`, `pnpm dev:prepare`, or `pnpm db:deploy`; these commands apply migrations. See [migration impact](#migration-impact).

| Service | Local URL |
| --- | --- |
| Website and workspaces | <http://localhost:4321/> |
| API health | <http://localhost:3000/v1/health> |
| OpenAPI | <http://localhost:3000/openapi.json> |
| Storybook, when started | <http://localhost:6006/> |

| Command | Purpose |
| --- | --- |
| `pnpm all` or `pnpm dev` | Start PostgreSQL, apply migrations, and run API and web |
| `pnpm all:storybook` | Start the full stack plus Storybook |
| `pnpm all:web` | Run only the frontend |
| `pnpm dev:prepare` | Prepare PostgreSQL and apply migrations |
| `pnpm storybook` | Run only Storybook |
| `pnpm db:up` / `pnpm db:down` | Start / stop PostgreSQL; stopping retains its volume |
| `pnpm db:seed` | Insert local fixtures and sample catalog/conversation data |

`Ctrl+C` stops the development servers; PostgreSQL stays running until `pnpm db:down`. The seed is separate from startup and does not overwrite catalog edits or archives. See [database seed](docs/SEED.md) for coverage, collisions, and verification. Sample content and prices are not business-approved offers.

### Configuration

Use the checked-in [API environment example](apps/api/.env.example) and [web environment example](apps/web/.env.example) for variable names. Keep `.env`, `.secrets/`, database values, session tokens, and service-account contents out of chat and commits.

- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` configure the API, Prisma, and type generator. A separate `DATABASE_URL` is unnecessary. Compose reads `apps/api/.env`; its project name remains `event_management_v2` to reuse the existing volume.
- Browser API: `PUBLIC_API_URL` points to the API including `/v1`.
- Catalog media: configure the R2 variables in the API example before testing actual uploads. Built-in package sample photos do not require uploads.
- Database clients such as DBeaver: use PostgreSQL on `localhost:5432` with the configured database name/user/password. The local defaults use no SSL. A containerized client may require `host.docker.internal` instead of `localhost`.

## Authentication

New registrations create local customer accounts with Argon2id password hashes; passwords must contain 8–128 characters. Google sign-in and existing Firebase email/password accounts are optional identity methods. Application roles always come from PostgreSQL.

All methods use the `em_session` cookie and hashed sessions in PostgreSQL. The frontend restores the account with `GET /v1/me`. Sessions expire after `SESSION_TTL_DAYS` (default 7), rotate on successful sign-in/linking, and are deleted on logout. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

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

Packages, services, and venues are independent flat records, each with one canvas page. A System Administrator save publishes a complete record immediately; there is no draft/publish/version-history lifecycle or structured package-to-service/venue assignment. Updates require `expectedUpdatedAt`; stale or archived edits return `409`. Archive hides a record from public selection. A package referenced by a booking request cannot be deleted.

| Catalog | Required save data |
| --- | --- |
| Package | Name, positive `maxGuests`, fixed total PHP price, and canvas sections; the catalog description is separate from Markdown widgets |
| Service | Name, description, positive whole-peso `hourlyRatePesos`, and a canvas photo |
| Venue | Name, location, description, and positive `maxGuests`; canvas photos are optional |

Package prices are stored as whole pesos; the API uses `{ kind: "fixed", currency: "PHP", amountMinor }` in centavos divisible by 100. Booking snapshots use `packageName`, `packagePrice`, and `packageMaxGuests`. Migrated service rates and venue guest limits may be null on reads; saves enforce complete current input. Omitted service/venue canvas sections preserve saved content.

The shared editor uses photo, Markdown, and video widgets on a 12-column canvas. Media uploads go through `POST /v1/admin/catalog-media`, remain pending until a catalog save references them, and stream through `/v1/catalog-media/{id}`. JPEG/PNG/WebP images allow up to 10 MiB; MP4/WebM videos allow up to 25 MiB. Photo/video widgets accept uploads only, with built-in sample photos retained for seeded packages; external URLs and hosted-player embeds are rejected. Video autoplay is opt-in and uses muted inline playback on customer previews.

Public media streaming requires a reference from a published, non-archived catalog record. System Administrators can preview their own pending uploads and archived-record media. Removing uploaded media triggers cleanup only when no widget references it; storage failures can leave unreferenced assets for retry. See [catalog media](context-factory/api/reference/external-image-urls.md) for storage, cleanup, and migration details, and [shared limits](context-factory/limits/SKILL.md) for validation ownership.

## Database workflow

For schema changes, edit `apps/api/prisma/schema.prisma`, create and review the migration, then regenerate Kysely types:

```sh
pnpm db:migrate
pnpm db:generate
pnpm check
```

`pnpm db:deploy` applies committed migrations; it does not create migrations. Never hand-edit generated `apps/api/src/db/types.ts`. Inspect both Prisma and SQL migrations because some database constraints extend beyond the Prisma model.

**`pnpm db:reset` deletes data without a confirmation prompt.** Its script forces a Prisma reset, reapplies migrations, and seeds the configured database. Check the target and use it only for a database whose contents may be discarded.

### Migration impact

Review all pending migrations before upgrading a populated database:

- `20261102130000_package_canvas` removes existing packages, package versions and service assignments, booking requests and status history, and booking-linked conversations/messages. General conversations and messages remain.
- `20261102180000_flat_services_venues` retains selected current content, or archives the latest content when none was published. It removes version tables and unselected canvas pages; uploaded storage objects are not deleted.
- `20261102190000_cleanup_catalog_fields` renames guest limits to `maxGuests` / `max_guests` and snapshots to `packageMaxGuests` / `package_max_guests`. It discards package event types, venue categories/photo URLs, and legacy service-image references. Existing canvas content and inquiry snapshots remain. Legacy storage objects are not removed remotely.

Back up affected records before deployment. Apply coordinated API/frontend contract changes with their migrations; do not edit applied migrations or reset a database to resolve drift. The [database guidance](context-factory/api/reference/database-and-migrations.md), [catalog media reference](context-factory/api/reference/external-image-urls.md), and [seed guide](docs/SEED.md) provide the related procedures.

## Verification

Run the checks matching the changed area:

| Command | Checks |
| --- | --- |
| `pnpm check` | Workspace types |
| `pnpm build` | Web production bundle and API types |
| `pnpm build:storybook` | Shared UI rendering build |
| `pnpm db:validate` | Prisma schema |
| `pnpm check:guidance` | Context-factory links, anchors, skill metadata, registration, and reachability; does not verify agent compliance or application behavior |
| `pnpm --filter @event-management/api test:auth` | Authentication and sessions with PostgreSQL and Firebase Auth emulator |
| `pnpm --filter @event-management/api test:packages` | Package/service catalog and shared canvas behavior |
| `pnpm --filter @event-management/api test:venues` | Venue catalog behavior |
| `pnpm --filter @event-management/api test:booking-requests` | Inquiry creation, snapshots, access, and status behavior |
| `pnpm --filter @event-management/api test:messages` | Conversation ownership, messages, read state, and expiry |

Integration suites create disposable local PostgreSQL databases and require permission to create them. Auth also requires the Firebase CLI on `PATH` and ports 9099, 4409, and 4509 free; it uses an emulator rather than production Firebase. Media tests use a local S3-compatible fake rather than production R2. See [API verification](context-factory/api/reference/verification.md) and the [seed guide](docs/SEED.md) for additional focused suites.

A passing build does not establish browser, persistence, or production-provider behavior. Verify affected customer/staff flows, permissions, reloads, and failure paths at the appropriate boundaries.

## Reference material

- [Database seed](docs/SEED.md): fixtures, sample records, rerun behavior, and verification.
- [Prevail interview summary](docs/PREVAIL_INTERVIEW_SUMMARY.md): timestamped findings and separate later scope decisions.
- [Full transcription](transcriptions/full-transcription.md), [Video 1](transcriptions/video-1.md), and [Video 2](transcriptions/video-2.md): preserved interview source text.
- [Repository guidance](AGENTS.md), [context factory](context-factory/README.md), and [agent index](context-factory/agents/README.md): contributor ownership, engineering/shared skills, documentation workflows, and QA guidance.
