# Linked service canvas widget

Date: 2026-11-17
Status: accepted
Authority: User approved the linked-service widget proposal and requested direct center-click access to usable service choices.
Implementation: implemented; see the [run](../../runs/2026-11-17_23-12-00_service-widget.md).

## Problem

Administrators need to feature an existing service within a catalog layout without introducing package service pricing or inclusion calculations.

## Decision

Add a Service widget to the shared package/service canvas. Its body opens a searchable picker immediately. A selection shows the service's current photo, name, description, and public details link; an optional caption explains the page-specific context. The widget displays no service price and does not change package or quotation amounts.

Persist only the service ID alongside the existing canvas fields. Resolve preview details on reads, without recursively embedding the linked service's canvas. Reject new unavailable references, preserve existing unavailable widgets for editing, and block deletion while any canvas references the service. Archived references render an unavailable placeholder.

## Alternatives considered

- Package inclusion controls support structured membership but introduce separate scope and pricing questions the user set aside.
- Independent service content blocks permit arbitrary details but duplicate existing photo/Markdown widgets and require manual synchronization.

## Rationale

The existing entity-owned JSONB canvas and shared renderer support placement and resizing. A linked preview keeps service details with their owner. The caption supplies context without creating a commercial commitment.

## Consequences

Deploy matching contracts, API, and frontend together; no schema migration is required. Service edits update previews on subsequent reads. Caption-only knowledge chunks avoid duplicating mutable service details across listings. Copying a canvas with an already-archived service is a new reference and is rejected until the widget is removed or replaced.

## References

- [Catalog rules](../../business/catalog.md)
- [Current implementation](../../../README.md#catalogs-and-media)
- [Entity-owned canvas](2026-11-16_catalog-canvas-jsonb.md)
