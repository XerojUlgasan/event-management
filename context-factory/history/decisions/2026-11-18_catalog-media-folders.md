# Owner folders for catalog media

Date: 2026-11-18
Status: accepted
Authority: User-approved folder proposal and subsequent development-scope clarification
Implementation: implemented; verification recorded in the [run](../../runs/2026-11-18_18-44-03_catalog-media-folders.md)

## Problem

A flat `catalog-media/<id>` folder hides which listing or booking owns each uploaded file.

## Decision

Keep one private bucket. New uploads start under `pending/<admin-id>/<media-id>.<ext>`. Saving an owner promotes its uploads into `packages/<package-id>/`, `services/<service-id>/`, or `bookings/<booking-id>/custom-package/`, with `images/` and `videos/` subfolders. File extensions follow the validated MIME type. Stable IDs prevent renames from changing paths. Custom packages copy uploads and dedicated thumbnails independently.

The project was in development at the time. The user explicitly excluded existing-document migration and preservation from this task. Do not add a storage backfill or move-tracking table. This does not authorize deleting or resetting existing data.

## Alternatives considered

- Flat keys are simple but hide ownership.
- Name-based folders are readable but require relocation when listings are renamed.
- A durable move journal supports crash recovery but exceeds this development task's needs.

## Consequences

API URLs and access checks still use media IDs. Copy failures leave readable pending files and can be retried by saving again. A copied object can remain unreferenced after an interrupted transaction; there is no durable recovery queue. Photo freshness follows immutable media identity rather than location.

See the [catalog media reference](../../areas/api/references/external-image-urls.md) for current lifecycle behavior.
