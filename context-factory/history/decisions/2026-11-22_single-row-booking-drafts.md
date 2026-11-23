# Use the booking request as its conversational draft

Date: 2026-11-22
Status: accepted
Authority: The user approved a single booking record, ordinary chat summaries, and model-callable submission after consultation.
Implementation: [Local implementation and verification](../../runs/2026-11-22_00-39-41_single-row-booking-drafts.md)

## Decision

An empty `submitted_at` identifies an editable request. A guest draft belongs to a conversation and acquires its customer on claim. Submission validates the saved fields, summary and current catalog, sets the timestamp and starts the existing booking workflow on that row. The customer sees one chat and one booking reference. Pricing extras, quotations and scheduling remain administrative responsibilities.

## Consequences

Requests can lack contact, dates or ownership during collection. Ordinary booking reads and management operations must select submitted rows. The migration preserves active drafts and historical review text from the [earlier design](2026-11-21_conversational-booking-drafts.md). The [specification](../../../docs/specs/amac-conversational-booking.md) records the booking fields and tool behavior.
