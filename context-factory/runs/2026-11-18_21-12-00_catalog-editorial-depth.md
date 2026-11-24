# Catalog editorial depth

Started: 2026-11-18T20:58:00+08:00
Updated: 2026-11-18T21:12:00+08:00
Status: complete
Scope: User-requested correction of low-effort catalog Markdown, with capability-tier delegation. Preserve insert-only behavior and unrelated work; no shared database reseed, paid provider calls, commit or deployment.
Checkout: main, 1157772d4cab22a6302d50d8a28c57861a4a9c5e; existing curated-seed changes and concurrent unrelated AI indexing work remain uncommitted.
Continues: [Curated catalog seeds](2026-11-18_20-49-00_curated-catalog-seeds.md)

## Goal

Replace the initial short, repetitive catalog copy with useful fictional demo content that supports catalog comparison, search and detail retrieval.

## Result

All 23 package and 20 service canvases now contain an authored introduction and four detailed sections. Two Terra writers owned separate editorial modules; an independent Sol reviewer checked all pages and the integrated seed composition.

## Changes or findings

- [Package editorial](https://github.com/XerojUlgasan/event-management/blob/5da111cfe4b9bb383995c3e39a54f1977bd932b0/apps/api/src/db/seed/package-editorial.ts) describes occasion-specific layouts, program timing, inclusions, exclusions and preparation. Civil wedding FAQs, conference responsibilities, launch cues and family accessibility briefs vary the structure.
- [Service editorial](https://github.com/XerojUlgasan/event-management/blob/5da111cfe4b9bb383995c3e39a54f1977bd932b0/apps/api/src/db/seed/service-editorial.ts) distinguishes deliverables, equipment quantities, working windows, site needs and suitable alternatives. Fixed windows include setup and packdown; hourly services retain their pricing model.
- [Composition](https://github.com/XerojUlgasan/event-management/blob/5da111cfe4b9bb383995c3e39a54f1977bd932b0/apps/api/src/db/seed/curated-catalog.ts) separates metadata from authored prose and estimates Markdown/table heights. Narrow rendering exposed four clipping cases, corrected before the final audit.
- [Seed guide](../../docs/SEED.md) identifies content owners and preserves the fresh-database boundary. Existing catalog rows remain untouched on rerun.

## Decisions

Fictional demo terms remain distinct from business commitments. Keep canonical numeric prices and rates in metadata. Automated length guards prevent placeholder regression; independent editorial review establishes content relevance.

## Verification

API types, 10 focused seed/AI tests and 21 web catalog tests passed. The disposable seed test checks original Markdown preservation and rerun behavior. Browser checks rendered all 43 fixtures at 320, 520 and 1100 pixels using production fonts: 129 cases with no Markdown/table clipping, horizontal document overflow or broken images. Representative wide and narrow screenshots were inspected. These are synthetic preview and disposable-database proofs, not live vector retrieval or shared database results.

## Remaining work

Existing databases and embeddings were not refreshed. No provider quality claim follows from source preparation tests.

## Resume here

Review the two editorial modules and seed guide. A future demo refresh must name its target and preserve the insert-only seed contract.
