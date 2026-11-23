# Quotation package add-ons

Started: 2026-11-21T00:00:00+08:00
Updated: 2026-11-21T00:09:44+08:00
Status: complete
Scope: Automatic add-on charges, quoted price/rate overrides and whole hours, compact quotation UI, local verification.
Checkout: main at f17d2a1a4c9946004e3b5c59fe01ec1640bc1e93, initially clean.
Continues: [Package editor UI](2026-11-20_23-43-08_package-editor-ui.md) and [package service terms](2026-11-20_23-03-00_package-service-terms.md).

## Result

The first private-package quotation copies its add-ons. The admin can edit prices, rates and hours in labeled dialogs, save a partial draft, or remove a charge. Revisions preserve saved edits and omissions, flag charges covered by the revised base, and retain the sent history. Shared controls and tokens support compact rows with accessible icon actions.

## Decisions

[Quotation package add-ons](../history/decisions/2026-11-21_quotation-package-addons.md) records the pricing, archive and removal rules.

## Verification

- The quotation suite passed 23 checks with migrations replayed against disposable PostgreSQL. Coverage includes calculated and overridden charges, reopen/revision, removals, archived and newly included services, exact customer delivery, authorization, stale writes, and database constraints.
- The web DOM suite passed 26 checks. Desktop and 390 px browser coverage used actual components with a synthetic API. Fixed and hourly prices, keyboard focus, failed save and retry, removal with an incomplete line, sending, and revision passed.
- The web and UI type checks, web/Edge/Storybook builds, lint, environment checks, proposal-tool tests, guidance checks, and quotation UI design detector passed. Aggregate checks still report existing thumbnail structure, unrelated static design, and guest-chat API type issues.
- Independent Sol review cleared the repaired diff. Terra/Sol routing was requested for delegated work. Execution metadata did not independently confirm the delegated models.

## Remaining work

Release the migration followed by the matching API and web code for the intended application database. These checks used local fixtures and disposable databases.

## Resume here

Review the scoped diff, especially the quotation add-on migration and pricing tests. Keep generated browser fixtures and disposable databases separate from application services.
