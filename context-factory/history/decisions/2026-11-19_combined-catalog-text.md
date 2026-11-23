# Combined catalog text

Date: 2026-11-19
Status: accepted
Authority: User requested that only photo widgets be indexed separately and all Markdown across sections be grouped into one entry.
Implementation: Implemented in source; verification and operational limits are recorded in the linked run.

## Decision

Each eligible catalog package or service produces one `text` knowledge row and one separate row per photo widget. The text contains the existing listing facts, full original Markdown strings across all sections, and linked-listing captions. Preserve section order and the existing y/x/original-index widget ordering, with listing and section context. Do not slice text by length or expand linked listings. Video remains excluded.

Use the new stable `text` key. Current-source assessment marks old overview, Markdown, and linked-caption keys withdrawn, and retrieval excludes them. The existing owner reconciliation removes those keys and creates the combined row during a save or reindex. Preserve matching photo keys, content, hashes, and embeddings; the photo pipeline and vector space are unchanged. No schema migration is needed.

## Rationale and consequences

The listing is the unit of text knowledge, preserving relationships across authored widgets and sections in one embedding input. Photos retain independent visual retrieval. Editing any included text refreshes the combined text embedding while unchanged photo vectors remain reusable.

Existing listings need a save or **Index pending** with the matching worker to generate combined text vectors. The separate `catalog:embed` CLI can also rebuild them and calls the provider. This code change does not itself reindex application data.

The application preserves and submits the entire combined text. [Gemini Embedding 2 has an 8,192-token input limit](https://deepmind.google/models/gemini/embedding/), so source preparation alone cannot prove that a longer listing is fully represented in a provider vector. No summarization, alternate model, or fallback text splitting is introduced. Live provider behavior is separate from synthetic-provider tests.

## References

- [Current implementation](../../../README.md#current-implementation)
- [Preparation](../../../apps/api/src/services/ai/workflows/prepare-catalog-knowledge.ts)
- [Original ingestion decision, superseded for text granularity](2026-11-16_catalog-embedding-ingestion.md)
- [Implementation run](../../runs/2026-11-19_21-19-36_combined-catalog-text.md)
