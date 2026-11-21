# Missing business information

Started: 2026-11-21T21:51:14+08:00
Updated: 2026-11-21T21:55:50+08:00
Status: complete
Scope: Handle a deleted business profile and verify first-save recovery.
Checkout: main, 67253d2, with the existing uncommitted business information feature.
Continues: [Simplify business information](2026-11-21_21-21-55_simplify-business-information.md)

## Result

Deleting the profile row previously made both reads return 404. The local database had zero rows, and the website proxy reproduced that response. A missing row now opens the editor with empty fields and a message that no information has been saved. Public reads return empty details. Both return a null update timestamp.

The first admin save inserts the singleton. If another admin creates it first, the later save returns the existing 409 conflict and the editor keeps the draft for review. Edits to an existing row still use its timestamp and row lock. The shared response and save schemas carry the nullable version. The editor reuses its PageHeader description and existing form controls.

## Verification

After the local Edge bundle rebuild, the authenticated website proxy returned 200 for the absent profile. Chromium opened the admin page with all ten inputs empty and editable and the save button enabled. This check left the local profile table empty and logged out the temporary fixture session.

The focused API suite uses a disposable migrated database to verify first save, readback and single-winner concurrent creation across the Node and Edge handlers. The editor DOM suite covers submitting a null timestamp, clearing the empty-state message on success, and retrying genuine load failures. Hosted deployment is separate.

## Resume here

The running local page serves the fix. All 14 API tests and 16 web tests passed. The broader API type check still flags the guest-chat test's PoolClient type. Structure and design checks report existing catalog and message findings.
