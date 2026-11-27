# Database seed

Start local PostgreSQL with `pnpm db:up` and configure the [Cloudflare R2 media bucket](../context-factory/workflows/implement/references/development.md#cloudflare-r2-storage) in `apps/api/.env` or the command environment. Verify both targets before seeding. Use a dedicated bucket or prefix for disposable databases. Existing catalog listings keep their stored references during reruns.

```sh
pnpm db:deploy
pnpm db:seed
```

The seed runs in one PostgreSQL transaction. It inserts fixtures and uploads local media without provisioning Firebase accounts, sending outbound messages, or calling an AI provider.

## What it inserts

- **Local accounts and conversations** include the designated System Administrator, five named user fixtures, ten demo customers, and five connected demo conversations with two messages each. New accounts use the shared local fixture password defined in the seed source.
- **Public catalog** includes exactly 10 packages and 10 services on a fresh database. Each has composed canvas sections, at least three distinct illustrative photographs with alt text, and a dedicated thumbnail using its lead photo. Packages describe capacity, schedule and scope. Services cover distinct workflows and offer both fixed-price and hourly-only options. Several connect to complementary standalone services. The photos and catalog terms are illustrative demo content.
- **Showcases** include three published records and one draft. Each uses its own uploaded cover and ordered gallery.
- **Business information and agent settings** supply the Styled by AMAC demo profile and default AMAC instructions. The settings seed fills the untouched defaults and preserves administrator changes on rerun.
- **Connected scenario** keeps 100 users, sessions, booking requests, status-history rows, linked conversations, messages, event days, and quotation versions. Users are `scenario.user001@amac.example.test` through `scenario.user100@amac.example.test`; users 001–004 are System Administrators. Booking references run from `SCN-001` to `SCN-100`. Requested and operational dates reach both edges of the 30-day window before and after the seed clock. Forty accepted requests own the 100 event days.
- **Quotations** cover 50 eligible scenario bookings with a superseded first version and a sent replacement. Twenty-six versions are base-only. The remainder include an addition and a deduction. Totals use the stored proposal price and the API's centavo calculation. Each version has its own delivery message and send audit event.

[Package copy](../apps/api/src/db/seed/package-collection.ts) and [service copy](../apps/api/src/db/seed/service-collection.ts) define each listing's metadata, Markdown and images. The [canvas builder](../apps/api/src/db/seed/curated-catalog.ts) uses the same widget format as the admin editor and public detail pages. Assets belong under [the seed asset directory](../apps/api/src/db/seed/assets) and are uploaded using the [catalog and showcase Storage conventions](../context-factory/areas/api/references/external-image-urls.md#storage-filing-and-recovery).

Fresh catalog canvases use five opening layouts and a three-row height for photos, Markdown, and related-service widgets. The renderer clips overflow at the saved height. Showcase details use their cover and ordered gallery.

## Repeat runs and collisions

Catalog and scenario fixtures use stable IDs. The seed initializes the canvas and thumbnail only for a newly inserted listing. Reruns preserve saved names, pricing, canvas edits, archive state, gallery order, account credentials and session hashes. An existing listing with a conflicting name or slug keeps its data. The refreshed 10/10 count applies to fresh databases. Older public listings, including the three legacy sample packages, stay in a previously seeded database. Use a fresh disposable database to see only the refreshed catalog.

Missing scenario bookings use persisted public package capacity and pricing. If all seeded packages have been archived or unpublished, existing activity is preserved and the seed skips creating further scenario activity. Quotation versions retain their IDs, totals and delivery history. Previously selected booking requests remain selected after closure.

Each photo uses a stable media ID and private object key. An interruption can leave objects behind if PostgreSQL rolls back. A retry reuses an exact byte match and rejects conflicts without replacing existing media. Files are served to customers through the current catalog and showcase API media endpoints.

Set `SEED_RANDOM_SEED` to configure the deterministic assignment of scenario statuses while preserving status counts. `SEED_CLOCK` optionally fixes connected demo and scenario timestamps to a UTC instant such as `2026-10-31T00:00:00Z`. These variables apply when rows are first inserted.

## AI catalog demo

AMAC uses `searchPublicCatalog` for catalog filters and optional semantic ranking, then `getPublicCatalogItem` for current facts and ordered Markdown. Package filters use price and capacity. Service price filters distinguish fixed base prices from hourly rates.

Knowledge preparation emits one combined text entry per listing, plus a separate chunk for each photo with its alt text and caption. Seed writes do not schedule indexing. After checking the target and configuring the embedding worker, use the existing backfill command when you need semantic ranking:

```sh
pnpm --filter @event-management/api catalog:embed
```

Backfill processes all eligible catalog owners in the configured database and makes paid provider calls. Confirm readiness in the admin Knowledge Catalog. Catalog filters and detail reads work without embeddings.

Examples include a civil wedding for 30 guests under PHP 80,000, a workshop for 60 attendees, a fixed-price coffee cart, and an hourly reception emcee.

## Catalog and account cleanup migration impact

Migration `20261114151517_complete_catalog_staff_removal` removes the obsolete staff role and staff tables, converts former staff and undesignated administrators to customers, revokes sessions for converted accounts, and keeps only designated System Administrators as administrators. At that stage it removes venue-catalog records and their pages while preserving pages owned by packages or services, plus shared media. It also drops coordinator and checklist-delivery metadata. Migration `20261116072801_embed_catalog_canvas` later embeds the remaining canvases in their package/service owners and drops the page/section/widget tables. Follow-up migration `20261114154206_remove_event_checklists` drops the event-checklist table and content validator, removing saved task definitions and progress. Historical migration files remain unchanged as evidence of the earlier schema.

After applying the migration, use the existing stale-media cleanup command if unreferenced storage objects should be removed:

```sh
pnpm --filter @event-management/api media:cleanup
```

The cleanup command removes stale media only; it is separate from the migration and should be run against the intended storage environment.

## Entity-owned catalog canvas migration impact

Migration `20261116072801_embed_catalog_canvas` adds `packages.canvas` and `services.canvas`, backfills each owner's sections and widgets in display order while preserving section/widget IDs, fields, and media IDs, then drops `catalog_widgets`, `catalog_sections`, and `catalog_pages`. It preserves package/service owner timestamps, `media_assets`, uploaded Storage objects, and the relational assignments present at that stage. Migration `20261118121512_remove_package_services` later drops those assignments and clears affected derived overview chunks; it preserves the seeded records and canvases. Apply it with the matching API; the [database guidance](../context-factory/areas/api/references/database-and-migrations.md) describes the new storage contract.

## Package-canvas migration impact

Migration `20261102130000_package_canvas` intentionally removes existing package data, package version history and service assignments, booking requests and status history, and conversations/messages linked to booking requests. General conversations and their messages remain. This migration runs before seeding on an existing database; the seed itself does not perform this cleanup. Review and back up relevant data before applying the migration to a database that contains records.

## Verify with a disposable database

The focused integration suite creates a disposable local PostgreSQL database and a local test double for signed R2 requests. It verifies public 10/10 counts, uploaded photo bytes and thumbnails, catalog details and filters, connected booking and quotation records, rerun preservation, and Storage retry after a rolled-back transaction. The separate migration test covers legacy sample media paths. Run both with:

```sh
pnpm --filter @event-management/api exec tsx --test tests/seed.test.ts tests/seed-showcases.test.ts tests/catalog-sample-photos-migration.test.ts
```

For a real Storage check, set `SUPABASE_DB_URL` to a fresh disposable database and configure an isolated R2 bucket or prefix. Run the migration, then run the seed twice to check reruns.

```sh
pnpm db:deploy
SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
```

Use the read-only `context-factory/tools/qa/pg-query.mjs` helper with the same `SUPABASE_DB_URL` if SQL inspection is useful. Remove the disposable database when finished.
