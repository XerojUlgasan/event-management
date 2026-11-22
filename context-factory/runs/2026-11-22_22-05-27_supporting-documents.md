# Admin supporting documents

Started: 2026-11-22T22:05:27+08:00
Updated: 2026-11-22T22:39:12+08:00
Status: complete
Scope: Implement private PDF upload, extraction, per-chunk embedding, and admin progress.
Checkout: `main` at `b08fd6cb` with uncommitted feature changes.
Continues: [Combined catalog text](2026-11-19_21-19-36_combined-catalog-text.md) for the existing embedding path.

## Goal

Let a System Administrator upload a supporting PDF and see it reach Ready after the background worker saves all its vectors. Preserve physical page spans and heading information for future use.

## Result

The [Supporting Documents tab](../../apps/web/src/components/workspaces/admin/ai/SupportingDocumentsPage.tsx) shows filenames, page counts, progress, unreadable pages, and Retry when queued work exhausts its attempts. The [README](../../README.md#admin-supporting-documents) records scope, limits, and storage setup.

## Changes or findings

- The [migration](../../apps/api/prisma/migrations/20261122140734_supporting_documents/migration.sql) adds server-only document and chunk tables. The original PDF stays in a private bucket.
- The [extraction handler](../../apps/api/src/services/background-jobs/handlers/extract-supporting-document.ts) saves ordered chunks and enqueues one job per chunk atomically. Each chunk starts with an empty vector. The [embedding handler](../../apps/api/src/services/background-jobs/handlers/embed-document-chunk.ts) writes the vector, model, and timestamp together after checking the lease and input hash.

## Decisions

The first version accepts PDFs with selectable text up to 25 MiB and 200 pages. Chunk sizes and overlap use local token estimates. Pages that require OCR put the document into Needs review.

## Verification

Applied the migration to local Supabase. The browser uploaded a two-page PDF, and the isolated local worker saved four `pgvector` rows using a simulated embedding provider. A scanned PDF showed Needs review at a 390 px viewport. The API scripts `test:supporting-documents`, `test:background-jobs`, `test:catalog-knowledge`, and `test:edge` passed, as did the chat image and route tests, API type check, Edge build, and web build. Existing web type, structure, design, and historical guidance link failures remain outside the feature.

## Remaining work

Live embedding-provider execution and hosted rollout remain unverified. Document retrieval and assistant integration are a later phase.

## Resume here

Open `/app/ai/documents` locally as a System Administrator. Use the README setup when preparing a hosted deployment.
