# Shared peso conversion and civil dates

Date: 2026-11-18
Status: accepted
Authority: User asked to extract repeated API and website logic into the util that fits each case
Implementation: implemented; unit tests cover the helpers in `apps/api/tests/shared-values.test.ts`, `apps/api/tests/sql-page.test.ts`, `apps/api/tests/service-result.test.ts`, and `apps/web/tests/formatting/`

## Problem

Peso/centavo conversion and IANA civil dates were copied in the API and the website. Page SQL, service errors, peso labels, and stale request guards were copied inside one app.

## Decision

Put whole-peso conversion in `@event-management/contracts/money` and civil-date parts in `@event-management/contracts/calendar-date`. Keep peso display, en-PH formatting, request-generation guards, and older-page cursor checks in the website. Keep timestamp SQL, keyset predicates, catalog text search, service errors, error JSON, and OpenAPI JSON content in the API.

## Alternatives considered

- Leave each copy in place. That keeps local wording, and the copies drift.
- Put display formatting in contracts. The API does not render pesos or en-PH dates.
- Merge daylight-saving instant resolution into the shared date helper. The website and API already resolve ambiguous local times differently.

## Rationale

The shared functions are pure and already agree on whole pesos and on `en-CA` civil dates. SQL, HTTP envelopes, and React request guards stay next to the runtime that uses them.

## Consequences

Package prices stay whole pesos in the database and centavos on the wire. `pesosToCentavos` rounds. Callers that need an overflow check, including quotation base prices, still apply that check to the converted value. Display strings such as audit lines that say `PHP` stay on the website. The website's daylight-saving loop still owns ambiguous local times.

## References

Current ownership is in [package exports](../../areas/packages/references/ownership-and-exports.md).
