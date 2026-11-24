# Expanded catalog Markdown

Started: 2026-11-24T18:05:11+08:00
Updated: 2026-11-24T18:14:00+08:00
Status: complete
Scope: Merge verified copy into local main and verify the combined seed, catalog rendering, and live search in disposable services.
Checkout: Local main with merge `772d3ca38fa22bcf0eea07a7292fe467eb44cd7c` and tested sizing fix `daead003d094af2c640e24bca239e3d67380f894`.
Continues: [Compact catalog widgets](2026-11-24_18-01-00_compact-catalog-widgets.md)

## Result

The merge includes copy commit `341df6097bbb830c911ecb3fa8628c9b693f3eee`. All 80 widgets in the [package](../../apps/api/src/db/seed/package-collection.ts) and [service](../../apps/api/src/db/seed/service-collection.ts) collections now contain 99–126 words. Canonical listing metadata and asset references match the baseline.

The first combined seed clipped the last line of Reception Emcee’s “What the host covers” by about 8 px at a 320 px viewport. The [seed builder](../../apps/api/src/db/seed/curated-catalog.ts) now estimates 33 characters per line in the narrow stack, giving that widget one additional row. A second fresh disposable stack verified the correction.

## Verification

- The corrected stack applied 95 migrations. PostgreSQL and public detail payloads preserved all 80 Markdown bodies byte-for-byte and all 60 image responses matched the bundled assets. The largest widget used 17 rows. A second seed preserved catalog and image digests.
- Chromium checked all 20 detail pages at 320, 390, 594, 595, 700, and 1280 px. All Markdown fitted and all images loaded. The emcee’s last line had about 35 px of clearance at 320 px. The fixed desktop grid still leaves blank space below some text.
- All 80 prior Gemini vectors qualified for reuse after matching current status, identity, model, pipeline, prepared input and input hashes. The ordinary backfill reported 80 unchanged. Fresh Gemini query calls ranked all five intended results first in text-only scoring, admin HTTP search and public catalog search.
- Seed, knowledge, public-search and web catalog tests passed, along with API and web type checks. The design checker still flags an existing message-style token. Guidance link checks still report two historical paths.

## Resume here

Open the integrated [packages](http://127.0.0.1:49649/packages), [services](http://127.0.0.1:49649/services), or [Knowledge Catalog](http://127.0.0.1:49649/app/ai/knowledge). The local API uses port 49648, Storage uses 49650, and PostgreSQL uses 49651. The user services are `clemora-catalog-verified-site` and `clemora-catalog-verified-api`. Use the [seed guide](../../docs/SEED.md) for a fresh isolated corpus.
