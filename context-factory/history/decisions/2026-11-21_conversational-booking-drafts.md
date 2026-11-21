# Review and submit a conversational booking draft

Date: 2026-11-21
Status: superseded by [single-row booking drafts](2026-11-22_single-row-booking-drafts.md)
Authority: User approved the AMAC conversational booking specification and requested its implementation.
Implementation: implemented in the local checkout. [Implementation and evidence](../../runs/2026-11-21_23-50-39_conversational-booking.md)

## Decision

A conversation owns one server-side draft. AMAC can collect facts and recommend public catalog items while that draft is incomplete. A customer can choose a package, request extra coverage or describe a custom service. The server writes the reviewed facts into a typed chat message, including the catalog revision. Only the owner’s signed-in reply to the current review can submit the inquiry.

## Consequences

Guests keep the same thread and draft when they sign in and claim it. Submission atomically binds the request, history, notification and receipt to the original chat. Retrying the confirmation returns its receipt. Changes to the intake or catalog require a fresh review. Administrators retain responsibility for pricing extras, issuing quotations and scheduling.

## References

- [Approved specification](../../../docs/specs/amac-conversational-booking.md)
- [Prior decision on booking from an existing conversation](2026-11-17_conversation-booking-intake.md)
