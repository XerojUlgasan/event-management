# Catalog canvas validation in the application

Started: 2026-11-16T16:43:00+08:00
Updated: 2026-11-16T16:56:00+08:00
Status: complete
Scope: User-authorized investigation and fix moving canvas validity from database functions into frontend/application validation. Local migration and disposable verification; no commit or hosted deployment.
Checkout: feat/ai at 4c2032f; pre-existing staged canvas and unstaged catalog/pricing/AI/message changes preserved.
Continues: [Catalog creation details](2026-11-16_16-34-10_catalog-creation-details.md) and [Catalog canvas JSONB](2026-11-16_15-43-53_catalog-canvas-jsonb.md)

## Goal

Validate the complete canvas in the website before uploading or saving, retain server enforcement, and remove the database document-validation function.

## Result

Shared runtime schemas now belong to contracts. The package/service/private-package editor reports section/widget errors before upload and validates completed uploads before save. API requests, stored-document readers/writers, and both seed writers use the application schemas.

## Changes or findings

- The API already enforced canvas document rules; the complete browser preflight was missing. Pending uploads remain valid only for widgets with selected files.
- Follow-up migration `20261116090100_validate_catalog_canvas_in_app` removes the SQL function and its two constraints. The original applied migration remains unchanged. A configured-loopback before/after hash confirmed complete package/service/media rows were preserved.
- Replaced an obsolete integration assertion expecting SQL rejection with an API invalid-edit rejection and unchanged-content assertion. The first suite failure cascaded from that obsolete assertion; the corrected suite passes.
- Luna audited coverage, Terra extracted schemas/tests, and Sol independently reviewed the integrated code without actionable findings. The lead integrated and verified the result; no model substitutions or delegated work remain.

## Decisions

[Application validation ownership](../history/decisions/2026-11-16_catalog-canvas-application-validation.md) supersedes SQL validation placement only.

## Verification

25 API catalog/schema/migration tests, 15 web catalog/SSR tests, 11 quotation tests, seed rerun verification, and 9 guidance tests passed. Workspace checks, Prisma validation, web/API production and Edge builds, structure/design checks, formatting of scoped source, and diff checks passed. Existing build chunk-size warnings remain.

Isolated browser fixtures verified invalid photo/video saves with no write, recovery to a valid Markdown save, and a selected photo uploading before a save containing its returned media ID. These checks use in-memory HTTP fixtures; API integration uses disposable PostgreSQL and fake Storage. Public SSR tests exercise the real catalog compositions. Package reuse audit retained existing dialog, inline alert, notification, canvas, styles, and tokens; no shared presentation changes were needed.

## Remaining work

Hosted rollout and real Storage/provider behavior remain unverified. No required local implementation remains.

## Resume here

Review the scoped validation delta and follow-up migration. Start with `packages/contracts/src/catalog-canvas.ts`, `CatalogEditor.tsx`, and the migration. Preserve unrelated changes and applied migration history; commit/deployment needs separate authorization.
