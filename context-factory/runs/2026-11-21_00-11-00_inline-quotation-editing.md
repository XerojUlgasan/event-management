# Inline quotation editing

Started: 2026-11-21T00:11:00+08:00
Updated: 2026-11-21T00:17:54+08:00
Status: complete
Scope: Remove the manual category picker, replace quotation dialogs with inline edits, and verify automatic add-on copying.
Checkout: main at f17d2a1a4c9946004e3b5c59fe01ec1640bc1e93 with the preceding quotation changes in the working tree.
Continues: [Quotation package add-ons](2026-11-21_00-00-00_quotation-package-addons.md).

## Result

Charge editing expands beneath the row. The plus button opens an inline fee or discount editor. Direction determines the category for new manual adjustments and existing categories remain valid. The revision reason also opens inline. The controls use the shared button and form components, preserve keyboard focus, and guard against sending while an edit is open.

An authorized admin's first draft copies saved private package add-ons on the API. An existing draft keeps its saved charges. Read-only checks found the new quotation fields in the main local Edge API's OpenAPI document, while the main and test-room databases lack the delivered-add-on constraint. The main local database also has a draft with package add-ons and no copied charge rows.

## Verification

The web interaction suite passed 27 tests and the API quotation suite passed 23 against disposable PostgreSQL. Web type and build checks and scoped lint passed. Desktop and 390 px browser checks used the real components with sample responses, including automatic rows on load, calculation, keyboard focus, and the inline adjustment. Workspace structure and design checks reported existing findings outside quotations.

## Resume here

Apply the pending quotation add-on migration on the intended database as part of an authorized rollout. Verify a fresh draft from a saved private package. The rollout itself leaves older drafts as saved.
