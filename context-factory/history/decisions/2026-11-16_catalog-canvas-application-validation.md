# Catalog canvas application validation

Date: 2026-11-16
Status: accepted
Authority: User instruction to move canvas validity checks from database functions into the frontend and website application
Implementation: implemented; migration applied to the configured loopback database, with no hosted deployment claim

## Problem

Canvas document rules were duplicated in PostgreSQL and API schemas. The browser did not check the whole document before attempting uploads or saves.

## Decision

Own runtime canvas schemas in `@event-management/contracts/catalog-canvas`. Use them in the shared editor before uploads and before saving, API request validation, stored-document reads/writes, and seed writers. A draft can omit an upload ID only when its widget has a selected pending file; final saves require a media ID.

Remove `catalog_canvas_is_valid(jsonb)` and its two check constraints through follow-up migration `20261116090100_validate_catalog_canvas_in_app`. Preserve the original migration, JSONB content, defaults, NOT NULL constraints, owner timestamps, and GIN indexes.

## Alternatives considered

- Keep SQL document validation: duplicates application rules and cannot provide browser feedback before upload.
- Validate only in the browser: requests and seed writes can bypass browser controls.

## Rationale

One application owner keeps browser feedback and accepted server input aligned. Media ownership, availability, permissions, and stale writes still require server enforcement.

## Consequences

Direct SQL writes bypass document validation. Deploy the application validators with the migration. API/media authorization and relational ownership remain unchanged.

This supersedes only the validation placement in the [earlier canvas decision](2026-11-16_catalog-canvas-jsonb.md); its entity-owned JSONB design remains accepted.

## References

- [Shared validation rules](../../areas/contracts/references/shared-limits.md)
- [Database guidance](../../areas/api/references/database-and-migrations.md#entity-owned-catalog-canvases)
- [Implementation and evidence](../../runs/2026-11-16_16-56-00_catalog-canvas-validation.md)
