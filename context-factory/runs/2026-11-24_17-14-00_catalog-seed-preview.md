# Catalog and showcase seed preview

Started: 2026-11-24T16:37:00+08:00
Updated: 2026-11-24T17:14:00+08:00
Status: complete
Scope: Local demo seed for packages, services, showcases, business information and agent settings.
Checkout: Local `main` at `9eb87804`.
Continues: [Catalog editorial work](2026-11-18_21-12-00_catalog-editorial-depth.md)

## Result

A fresh seed creates ten public packages, ten public services, three published showcases and one showcase draft. The 75 JPEGs are stored in [seed assets](../../apps/api/db/seed/assets), with credits in each collection. The business profile and AMAC defaults are persisted through their existing settings tables. [Seed guide](../../docs/SEED.md)

## Verification

- Ran the original seed regression before editing. Ran `pnpm db:deploy` against a fresh local preview database and ran the final `pnpm db:seed` twice from the primary checkout. Byte hashes for all 75 private Storage objects matched the checked-in photos. Catalog, showcase, media, business and agent row snapshots matched across reruns.
- Visited all 20 public catalog details at 390 and 1280 pixels. Each rendered three photos with no broken images, clipped Markdown or horizontal page overflow at those widths. The Birthday Playroom Party preview exposed an opening photo below the first screen. The revised layout shows the photo alongside the introduction on desktop. The saved grid can leave extra vertical space at intermediate widths.
- Verified all three public showcase covers and all nine gallery images in the browser. The showcase suite verified draft media access and preservation of admin edits. The public footer displayed the profile, and the admin APIs returned all seven profile groups and the requested agent instructions. Agent tests exercised settings delivery to the prompt using a mocked model.
- Focused seed, business, agent, auth, showcase and migration checks passed. The nine guidance tests passed. The guidance link check still reports two missing historical proposal-tool paths that also predate this work.

## Resume here

The preview serves this checkout locally at [Packages](http://127.0.0.1:4871/packages), [Services](http://127.0.0.1:4871/services) and [Showcases](http://127.0.0.1:4871/showcases). It uses a dedicated database and private Storage bucket. The website and API run under the user services `clemora-seed-preview-web-nov24` and `clemora-seed-preview-api-nov24` for this local session. Use a fresh database to reproduce the exact listing counts. Rerunning on an existing database preserves saved catalog and administrator edits.
