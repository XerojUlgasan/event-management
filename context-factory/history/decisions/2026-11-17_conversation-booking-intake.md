# Conversation-based booking intake

Date: 2026-11-17
Status: accepted
Authority: User approved creating a booking request from an existing chat and allowing a package-less request whose package is prepared by an administrator.
Implementation: implemented; [verification run](../../runs/2026-11-17_00-55-00_conversation-booking-intake.md)

## Problem

Customers may discuss their requirements before choosing a package. Requiring a catalog selection and creating a second conversation at submission separates the request from the negotiation that led to it.

## Decision

Customers can submit a request from their active general conversation with an optional catalog package. Submission binds that same thread atomically and preserves its messages and AI preference. Guests first sign in and claim their thread, then explicitly submit. Requests submitted outside a conversation still receive a new linked conversation.

A missing package is a valid intake state, with no known price. An administrator can attach a catalog package when no proposal exists, or create a booking-owned private package from scratch. Existing catalog and private-package workflows remain available. Quotations require a prepared package. Submission, package preparation, quotations, and scheduling do not confirm a booking or reserve dates.

## Alternatives considered

- Require a catalog package before intake: simpler validation, but customers seeking a custom arrangement would have to select an unrelated package.
- Create a new thread and copy or merge messages: would complicate history, ownership, and quotation delivery. Retaining the existing thread avoids that transfer.
- Link an already-created request to another thread: left outside this slice because each request already has one canonical conversation and the handling of both histories needs a separate decision.

## Consequences

The original catalog association is nullable and remains distinct from the current private proposal. Reads, event-day lists, and browser displays must handle this state. Catalog attachment and private-package creation serialize on the request revision. Guest account switching and claim retries must preserve the request-creation intent.

## References

- [Booking requests](../../business/booking-requests.md)
- [Messages](../../business/messages.md)
- [Quotations](../../business/quotations.md)
