# Booking requests read current package details

Date: 2026-11-16
Status: accepted
Authority: User instruction to remove booking-request package name, price, and maximum guests and derive them through package ID
Implementation: implemented; [verification and local migration](../../runs/2026-11-16_14-41-10_booking-package-details.md)

## Problem

Booking requests duplicated three values from their catalog package. Those values remained unchanged after catalog edits.

## Decision

Keep the original catalog `package_id` and derive `packageName`, `packagePrice`, and `packageMaxGuests` from that record on reads. Conversation headers and event-day lists use the same package identity. Read archived referenced packages too. Keep private proposals and saved quotation amounts under their existing owners.

## Alternatives considered

- Retain snapshots: preserves the original selection's values but conflicts with the requested removal.
- Read the private proposal: follows the current discussion but changes the meaning of the retained catalog `package_id`.

## Rationale

The package foreign key supplies the requested source of truth without synchronizing copied values.

## Consequences

Later catalog edits appear on existing requests. The migration discards the three stored values and their column checks; deploy the matching API with it. Existing booking history, requested dates, schedules, and quotations remain intact.

## References

- [Current booking rules](../../business/booking-requests.md)
- [Current implementation](../../../README.md#current-implementation) and [migration impact](../../../README.md#migration-impact)
- Supersedes the snapshot retention rule in [legacy engineering notes](legacy-engineering-notes.md#2026-11-11--inquiry-snapshots-and-quotation-proposals-have-separate-owners).
