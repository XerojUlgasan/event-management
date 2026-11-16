# Catalog knowledge storage

Date: 2026-11-16
Status: accepted
Authority: User approved the proposed single table and 768 dimensions, then requested its migration.
Implementation: Migration and Prisma model prepared; application database deployment, ingestion, and retrieval remain separate work.

## Problem

Prepare catalog text and individual photos for future retrieval while reusing the existing package, service, and media owners. Keep the derived storage small and rebuildable.

## Decision

Use one `catalog_knowledge` table with ten columns: `id`, `package_id`, `service_id`, `chunk_key`, `content_markdown`, `media_id`, `content_hash`, `embedding`, `embedding_model`, and `embedded_at`. Each row belongs to exactly one package or service and represents a text chunk or one photo. Prepared photo text includes listing/section context, Image description (`alt`), and Caption; reference the existing media asset instead of copying image bytes or Storage objects. Retain `content_markdown`; a later suggestion to rename it to `content_text` was not explicitly selected.

Use nullable `vector(768)` embeddings. The vector, model, and successful timestamp are either all NULL or all populated. Chunk keys are unique per owner. Owner and media deletion cascade to the derived rows; owner unique indexes cover their foreign keys, and media references have an index. RLS and revoked `PUBLIC`, `anon`, and `authenticated` grants preserve the existing server-only access pattern.

## Alternatives considered

- Separate document/image/model/job tables add ownership and lifecycle machinery outside this slice.
- Generic JSONB metadata duplicates structured canvas content without a current query requirement.
- Larger vectors can be evaluated later; a model/dimension change requires a coordinated reindex and query transition.

## Consequences

The migration starts empty. Eligible sources are non-archived catalog packages and all non-archived services, including standalone services. Private custom packages, customer records, conversations, inquiries, and quotations are excluded. Future application writers and retrieval must enforce eligibility, current canvas/photo references, dependent package refresh after service changes, hash-based invalidation, and guarded embedding writes. The table constraints do not implement these cross-record responsibilities.

The embedding model, exact splitting rules, refresh trigger, treatment of sample/decorative images and video, and actual-image versus description/caption-only photo embeddings remain unresolved. No model is hard-coded into pending rows. Future queries must use compatible model, dimensions, and preprocessing. Search does not establish inclusion, availability, final price, or booking confirmation.

## References

- [Prisma schema](../../../apps/api/prisma/schema.prisma)
- [Migration](../../../apps/api/prisma/migrations/20261116103220_add_catalog_knowledge/migration.sql)
- [Current implementation and setup](../../../README.md#current-implementation)
- [AI retrieval standards](../../areas/ai/references/standards-and-verification.md#retrieval-and-knowledge)
- [Database ownership](../../areas/api/references/database-and-migrations.md)
