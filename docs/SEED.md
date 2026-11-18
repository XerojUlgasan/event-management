# Database seed

After applying the API migrations to a local database, run:

```sh
pnpm db:seed
```

The command runs `apps/api/src/db/seed.ts` in one PostgreSQL transaction. It does not reset or truncate the database, create Firebase users, send outbound messages, or call payment or quote services.

## What it inserts

- **Local account fixtures:** the designated `admin1@gmail.com` System Administrator account and `user1@gmail.com`–`user5@gmail.com`, plus up to 10 `customerN@example.test` accounts. Newly inserted local accounts use the password defined in the seed source; credentials are not repeated here.
- **Package samples:** three directly published packages, each with a complete canvas containing a photo, an occasion concept, program timing, and scope/practical details:
  - The Grand Celebration — ₱185,000; maximum 150 guests.
  - The Intimate Gathering — ₱68,000; maximum 50 guests.
  - The Sweet Soirée — ₱95,000; maximum 80 guests.

  These are synthetic demonstration records, not business-approved prices or content. Their photo widgets reference checked-in sample images; the seed does not upload files to Supabase Storage.
- **Connected demo conversations:** one demo administrator and five customers under `demo.*@clemora.example.test`, with one general conversation and two messages per customer.
- **Interconnected scenario:** 100 users, sessions, booking requests, status-history rows, linked conversations, messages, and event days, plus 100 quotations and their delivery/audit records. The smaller curated catalog has **20 packages and 20 services**, each with its own complete canvas and dedicated thumbnail. Packages include civil weddings, Filipiniana and coastal receptions, debuts, birthdays, baptisms, workshops, conferences, launches, reunions, and anniversaries. Services cover styling, florals, sound/lighting, hosting, photography, booths, and coordination; both fixed-price services with included hours and excess rates, and hourly-only services are represented. Accounts are `scenario.user001@clemora.example.test` through `scenario.user100@clemora.example.test` and use the same local fixture password as the accounts above. `user001`–`user004` are System Administrators; `user005`–`user100` are customers.

  The scenario links those accounts to catalog rows, booking requests, conversations, messages, sessions, and event days. References use `SCN-001` through `SCN-100`. Status, archive, and guest-count values vary across legal combinations: 18 curated packages and 18 services stay public; two of each are archived. Together with the three named sample packages, a fresh seed has 23 packages, 20 services, and 43 nonempty canvases. Public browsing exposes 21 packages and 18 services. Requested dates, preferred dates, and operational event days stay inside the 30 days before and the 30 days after the seed clock, and the set reaches both edges. A clock of 30 October therefore fills 30 September through 29 November. Forty accepted requests own the 100 event days. Moved days point to scheduled replacements on the same request. Declined and cancelled requests have no operational days.

  Scenario media includes 40 attached package/service photos and 20 unreferenced sample images. Each canvas has distinctive Markdown, an illustrative photograph with literal alt text, and practical constraints. Five layouts vary photo/text placement; selected linked widgets describe optional or contextual ideas without implying inclusion. The attributed real photographs are stored locally alongside the original sample photos; see [photo sources and license](../apps/web/public/images/catalog-demo-assets.md). The seed neither hotlinks Google results nor uploads images to Storage. Scenario sessions mix current and expired rows; the raw session tokens are not stored or printed. The scenario does not create payments or Firebase users.

All 43 canvases have an authored introduction and four detailed sections. [Package editorial](../apps/api/src/db/seed/package-editorial.ts) includes occasion-specific seating plans, program flow, access considerations and scope boundaries. Examples include the civil wedding's decision FAQ, conference responsibility matrix and product launch cue sheet. [Service editorial](../apps/api/src/db/seed/service-editorial.ts) describes quantities, deliverables, working windows, setup requirements and exclusions; photography coverage differs from a booth's digital output, and speech audio differs from a reception DJ set. Fixed service windows explicitly include setup and packdown. These remain fictional demo terms, not approved business commitments. [Catalog metadata and composition](../apps/api/src/db/seed/curated-catalog.ts) retain prices, capacities and service rates separately from prose, and estimate widget heights for narrow-screen reading.

- **Quotations:** `seed/scenario/quotations.ts` adds two PHP versions to 50 scenario bookings: 50 superseded first offers, followed by 17 drafts and 33 sent offers. New fixtures do not create accepted quotations; customers respond through chat. Twenty-six versions are base-only; the others include a ₱2,500.50 addition and a ₱500.25 deduction. Base prices come from the stored current proposal and totals use the API's integer-centavo calculation. Each revision points to its superseded predecessor. Draft revisions require adjustment review. These are synthetic offers, not approved business prices.

  The 83 sent versions have exact-version messages in their booking conversation. The 253 audit events record admin creation, adjustment saves, revisions, and sending. These are additional rows beyond the original 100 scenario messages. Initial selection requires 50 customer bookings with an active conversation; closed requests are excluded. Conversation age and event end times do not affect selection. The module reads stored parents rather than replanning their statuses and does not reopen closed conversations. Quotations do not change booking statuses or create event days.

The seeded packages and services remain flat catalog records without private custom packages. Each owner stores its canvas as JSONB, including any linked-listing widgets; there is no relational package-service assignment table. The three named package samples keep their IDs, names, capacities, and prices and receive richer content only when first inserted; the scenario does not rewrite them. No venue-catalog or staff-account fixtures are created.

## Repeat runs and collisions

Reference package, connected demo, and scenario IDs are stable. Catalog and scenario rows are insert-only and do not overwrite existing edits, archives, passwords, or sessions. A package sample's sample media row and canvas are created only when the seed inserts that package row. Scenario package/service canvases are initialized only when the seed inserts their owner. A later run preserves an existing owner's edits, including an intentionally empty canvas; it does not fill missing sections or widgets inside that canvas. Other scenario child records continue to use stable IDs and their seed-specific insert-if-new rules. Existing records with a reserved ID or email are preserved; a collision can leave the corresponding sample or dependent content incomplete. Inspect the target if a fixture is missing; do not use the seed to reconcile collisions or clean shared data.

The demo conversation and scenario IDs are derived from stable keys. Existing catalog rows are not upgraded or republished on rerun. In particular, older `Scenario Celebration` and `Scenario Service` records retain their names and content: rerunning the seed does not replace the old catalog or remove surplus rows. The smaller curated catalog requires a fresh disposable/demo database. Do not reset a populated database just to refresh fixtures. Missing booking scenarios use the actual persisted catalog capacity, price, and archive state; custom/unpublished package collisions are excluded. New curated photo IDs have a separate stable namespace so recreating an owner cannot accidentally bind its new alt text to an older orphaned sample image. A second run does not rotate scenario session token hashes. Quotation IDs and `(booking_request_id, version)` keys stay stable. Previously selected bookings remain selected after later closure. Existing quotations and their lifecycle records, including historical accepted offers, are preserved; delivery/audit records are inserted only with a newly inserted quotation. The seed does not reconstruct deleted delivery/audit history for an existing quotation. Fresh-seed counts above do not describe an older database that retains accepted fixtures.

`SEED_CLOCK` optionally fixes connected demo and scenario timestamps. Supply a UTC timestamp such as `2026-10-31T00:00:00Z`; when it is omitted, current time is used. Existing rows are not retimestamped on rerun. Sample package timestamps use database defaults and are not controlled by `SEED_CLOCK`. `SEED_RANDOM_SEED` changes which scenario request receives each status. The status counts stay the same, and a new seed value does not rewrite rows inserted earlier.

## AI catalog demo

The current assistant uses `searchPublicCatalog` for exact catalog filters and optional semantic ranking, then `getPublicCatalogItem` for current facts and ordered canvas Markdown. Recommendations are composed by the assistant from those results. Package filters use total PHP price and guest capacity. Service filters distinguish fixed base prices from hourly-only rates; excess-hour charges are separate.

Knowledge preparation emits an overview, Markdown chunks of up to 6,000 Unicode code points, photo chunks with alt/caption context, and captions for linked listings. Linked canvases are not expanded into their parent, and video is not embedded. Gemini Embedding 2 indexes text and actual photo bytes into normalized 768-dimensional vectors. Distinct text, pricing, constraints, and appropriate images give the demo useful differences to retrieve; a semantic score alone does not guarantee suitability.

Direct seed SQL does **not** schedule embedding refresh. On the intended fresh demo database, apply the migrations and seed first. After checking the target and server-only embedding configuration, the existing backfill command is:

```sh
pnpm --filter @event-management/api catalog:embed
```

This makes paid provider calls and processes **all eligible catalog owners** in the configured database, not only seeded rows. Confirm readiness in the admin Knowledge Catalog before a semantic-search demo. Queryless catalog filters and the detail tool do not need embeddings. Changing database fixtures or passing synthetic-provider tests does not establish live model ranking.

Representative prompts to try after indexing:

| Prompt | Useful evidence to inspect |
| --- | --- |
| A civil wedding and merienda for 30 guests under PHP 50,000 | Civil Vows and Merienda; capacity, price, three-hour program, excluded meals/venue |
| Compare a coastal sunset wedding with a formal ballroom wedding | Different palettes, program scope, weather/access constraints, and illustrative photos |
| A first birthday with pastel decorations and a short program | Pastel First Birthday and child-focused timing/safety details |
| A conference for 180 delegates with registration and networking | Industry Conference Forum capacity, eight-hour flow, internet and power requirements |
| An hourly DJ for a reception | Reception DJ Set hourly terms and equipment exclusions |
| Table styling with a fixed budget and extra time | Intimate Table Styling fixed base, included hours, excess rate, furniture/food exclusions |

These are fictional offers and sample demo questions, not asserted live ranking results.

Migration `20261118123813_expand_catalog_sample_photos` adds the attributed local photo paths to the database allowlist while retaining the existing upload restrictions. The shared contract validator, Node photo reader, and Edge bundle use the same application allowlist. Deploy the matching assets/contracts/API with that migration before seeding.

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

The focused integration test creates a UUID-named local PostgreSQL database, applies checked-in migrations, runs the seed twice, checks the required fixtures, all 43 canvases, catalog filters/details, the 100-row booking scenario, quotation totals/revisions/delivery/audits, customer draft visibility, and rerun preservation after price edits and booking closure. It guards against the former short placeholder copy and checks that knowledge preparation preserves the curated Markdown. Length checks do not establish editorial quality; source review and rendered checks cover relevance and clipping separately. The media migration test checks populated-data preservation, accepted sample paths and rejection of untrusted media. Both suites drop only their disposable databases:

```sh
pnpm --filter @event-management/api exec tsx --test tests/seed.test.ts tests/catalog-sample-photos-migration.test.ts
```

For manual verification, create a separate local database, apply migrations, and point each seed command at it:

```sh
DB_NAME=clemora_seed_check pnpm db:deploy
DB_NAME=clemora_seed_check SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
DB_NAME=clemora_seed_check SEED_CLOCK=2026-10-31T00:00:00Z pnpm db:seed
```

Use the read-only `context-factory/tools/qa/pg-query.mjs` helper with `DB_NAME` pointed at the disposable database if SQL inspection is useful. Remove only the disposable database when finished; never point this procedure at a shared or production database.
