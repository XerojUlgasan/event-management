# Booking package and quotation status specification

Started: 2026-11-19T22:18:34+08:00
Updated: 2026-11-19T22:23:45+08:00
Status: complete
Scope: Investigate admin quotation/custom-package/catalog-assignment status eligibility and create a spec. No application implementation or runtime mutations.
Checkout: main at e4ff29442ab7ca112ef0a203b87bf04a03f5416c; initially clean
Continues: [Conversation-based booking intake](2026-11-17_00-55-00_conversation-booking-intake.md)

## Goal

Specify the user's rule: administrators can prepare quotations and booking packages unless the request is declined or cancelled. Verify current guards, callers, prerequisites, and test coverage.

## Result

Created the [specification](../../docs/specs/booking-proposal-status-eligibility.md) and linked it from the root README, keeping proposed behavior distinct from current implementation.

## Changes or findings

- API guards already permit `under_review`, `needs_details`, and `accepted`, excluding only `declined`/`cancelled` for quotation writes, custom packages, and catalog assignment.
- Booking package entry controls follow that matrix. Quotation controls lack booking eligibility and can offer writes that the API rejects on closed requests.
- The spec covers quotation eligibility, already-open package forms, status races, shared quotation callers, readable history, and the missing full status-test matrix.
- “Request quotation” is interpreted as the existing admin draft operation; catalog assignment remains limited to requests without a proposal. New request queues, replacement, and multiple packages are outside this interpretation.

## Decisions

Preserve existing package/version/conversation prerequisites and server transaction safeguards. Only this specification is authorized; application implementation remains separate.

## Verification

Parallel read-only Terra API/UI investigations completed. Lead verified consequential findings against current source and inspected test contents. Independent Luna spec review found no actionable inaccuracies or missing decisions; no model substitutions or unfinished delegated work remain. Guidance links/routes pass `pnpm check:guidance`; all nine `pnpm test:guidance` cases, scoped Prettier checks, and diff whitespace checks pass. Walked the applicable investigation, API/auth, frontend, business, documentation, and continuation routes, including the documentation routing scenario. No application tests, database changes, browser flows, services, or providers were exercised.

## Remaining work

The investigation/specification task is complete. Future application work must satisfy the spec's acceptance cases; current source inspection does not establish runtime or production behavior.

## Resume here

Read the spec and refresh the checkout before separately authorized implementation. Keep the three open statuses eligible and preserve terminal-state rejection at the API boundary.
