# Booking-owned add-ons

Date: 2026-11-22
Status: accepted
Authority: The user approved one booking-owned add-on list and clarified that package service widgets denote inclusions.
Implementation: [Booking-owned add-ons run](../../runs/2026-11-22_05-12-21_booking-owned-add-ons.md).

## Decision

Booking requests store the customer's request and any current add-on offer in the same `requested_services` array. A valid manual selection initializes an offer. An administrator can change or remove the offer while preserving the customer's original request. Package service widgets describe inclusions in the base price.

New quotations use the current package base price and the saved booking add-on offers. Send records a separate snapshot of the quoted amounts, terms, and hours. Cancel discards local adjustments. Confirmed add-on edits persist as booking changes.

The migration retains the terms and identities of existing private add-ons. An unmatched historical request stays available for review when the booking already had a private package or a delivered offer.

This supersedes package ownership in the [direct-send decision](2026-11-21_direct-quotation-send.md). The [quotation rules](../../business/quotations.md) describe the current workflow.
