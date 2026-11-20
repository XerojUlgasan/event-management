# Derive conversation availability

Date: 2026-11-20
Status: accepted
Authority: User approved deriving guest expiry from saved message activity and removing unnecessary conversation closure state after investigating SCN-001.
Implementation: implemented locally; [verification run](../../runs/2026-11-20_20-50-42_conversation-activity.md).

## Problem

The scenario seed created SCN-001's booking conversation as closed, blocking an otherwise eligible quotation. No explicit close feature is required, and storing closure separately from ownership and activity can contradict the intended availability rules.

## Decision

Remove conversation `status`, `closed_at`, and `guest_expires_at` from persistence and their closure fields from API/browser contracts. Signed-in general and booking-linked conversations remain available regardless of age or former closure. Guest availability ends 24 hours after the latest saved message from any sender, falling back to creation time for an empty thread. Reads, polling, and AI preference changes do not extend it. Claiming attaches the same history to an account and removes anonymous expiry through ownership.

## Alternatives considered

- Reopen only SCN-001: fixes the fixture but retains redundant lifecycle state.
- Expire all bookingless threads: would change the approved no-expiry rule for signed-in general chats.
- Persist a synchronized activity deadline: adds mutable state where saved messages already establish the deadline.

## Rationale

Ownership and message history establish the intended rules directly. Row locks serialize message writes and claims; activity is read after locks using a fresh statement snapshot. Bootstrap serializes on guest identity while preserving expired history.

## Consequences

Previously closed signed-in conversations become usable. Migration removes only retired lifecycle columns and related constraints/indexes, preserving all histories and AI preferences. Guest ownership constraints and account isolation remain enforced. API/frontend and migration must roll out together; hosted deployment remains separate.

## References

- [Message rules](../../business/messages.md)
- [Quotation rules](../../business/quotations.md)
- [Previous closure policy](legacy-engineering-notes.md) is historical and superseded by this decision.
