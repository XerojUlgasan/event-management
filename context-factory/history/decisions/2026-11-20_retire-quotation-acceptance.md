# Retire quotation acceptance

Date: 2026-11-20
Status: accepted
Authority: User instruction to clear the remaining quotation acceptance model after the customer actions were removed
Implementation: implemented locally; see the [cleanup run](../../runs/2026-11-20_20-20-37_quotation-acceptance-cleanup.md) and [no-legacy follow-up](../../runs/2026-11-20_20-24-06_remove-quotation-legacy-conversion.md)

## Problem

Customer agreement and requests for another offer happen through chat. The schema, contracts, and views still retained a separate acceptance state and timestamp for older quotations.

## Decision

Quotations use `draft`, `sent`, and `superseded`. Remove `accepted_at`/`acceptedAt`, the quotation `accepted` state, and its partial unique index. Keep administrator revisions, adjustment review, version links, financial values, exact-version messages, and audit history. Booking-request acceptance remains separate. The user's follow-up explicitly excludes legacy support, including automatic conversion of retired quotation states.

## Alternatives considered

- Retain acceptance fields for legacy records: preserves the old state model but leaves the cleanup incomplete.
- Delete accepted quotation rows: loses financial versions and linked history.

## Rationale

Apply the new state constraints directly, without rewriting quotation rows. The migration deliberately discards acceptance timestamps and retains audit events unchanged. The local database contained no accepted quotations or acceptance timestamps before removal.

## Consequences

Deploy the matching schema, API, and frontend together. Old API contracts expose a retired field. Regenerate database types after migration. Existing historical migrations and their isolated tests remain valid replay evidence.

## References

- [Current quotation rules](../../business/quotations.md)
- [Forward migration](../../../apps/api/prisma/migrations/20261120121409_remove_quotation_acceptance/migration.sql)
- [Migration regression](../../../apps/api/tests/quotation-acceptance-removal-migration.test.ts)
