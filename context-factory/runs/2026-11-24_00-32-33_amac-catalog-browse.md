# AMAC catalog browse attachments

Started: 2026-11-24T00:32:33+08:00
Updated: 2026-11-24T00:57:18+08:00
Status: complete
Scope: AMAC tool, API and shared message contract, migration, backend tests, and documentation in the assigned worktree.
Checkout: `feat/amac-catalog-browse` on local base `16b404b3`.
Continues: [Required AMAC reply suggestions](2026-11-24_00-11-29_required-amac-replies.md)

## Result

Broad requests can attach Packages, Services, or both with a short introduction. The audited tool accepts category names only. The API stores them in packages-then-services order with the reply and its required suggestions. The public catalog switch gates new attachments. Targeted recommendations still use verified listing facts, and saved recommendation cards keep their order. When a newer browse reply changes the subject, AMAC asks for the listing name on an ordinal follow-up and retains the older search cursor for explicit continuation.

## Verification

The isolated Node API on `59341` and image worker used local Storage on `59330` and PostgreSQL on `59331`. Prisma reported 92 finished migrations, including `20261124010000_assistant_catalog_browse`. The send and history OpenAPI schemas expose the optional array. Database constraint checks rejected empty, reversed, duplicate, and unknown categories and attachments on human messages.

The configured live Gateway ran the three broad requests and a budget-and-capacity recommendation in each chat scope. Broad turns executed only the browse tool. Image sends in both scopes produced and saved browse replies through the worker. Postgres and history readback confirmed the category order, required suggestions, and tool-to-message links. Disabling the catalog via the admin API prevented new catalog calls and attachments while saved attachments remained readable. The model still attempted a supporting-document lookup on each disabled turn.

API type checking and the Edge build passed. The targeted API, Edge, and worker suites passed 202 cases with six opt-in skips. The nine guidance unit tests passed. The wider messages suite still has a historical fixture that lacks `booking_requests.submitted_at`. Repository lint and guidance link checks report existing failures.

## Local main verification

Main fast-forwarded to `8e349757`. Prisma applied the additive browse migration on local Supabase PostgreSQL at `54322`, bringing the completed count to 92. The site remained available at `http://localhost:4321` after the Edge rebuild and worker restart. A live guest text reply and a worker-processed image reply each saved both category labels, suggestions, and a linked browse audit. A fresh history read returned the saved fields. The audit recorded zero inventory calls. API type checking and the Edge bundle build passed.

## Resume here

The head owns combined browser verification with the catalog overlay. The main stack remains running for that check. Hosted rollout remains unverified.
