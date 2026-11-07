# Functional QA after the UI refactor

Tested on 2026-11-06, Asia/Manila, against `00c32acb60a16b2d9fa7e6de4844f604b79edef7` on `main`. The starting working tree was clean. The comparison baseline is parent `5c0c8b4f3d7acb12731b1d4ce882ca0b64f5563d`.

## Result and boundaries

No new application functional regression was reproduced in the exercised journeys. Two UI issues remain: nested catalog Escape dismissal predates the refactor, and a new Storybook file-input example overflows at 320px. Neither was fixed during this testing task.

Tests used the existing local Astro server at `http://localhost:4321` and API at `http://localhost:4000/v1`, isolated Chromium contexts, disposable integration-test databases, and a temporary static Storybook server. Process working directories matched this checkout. The running API's exact loaded revision was not independently established; integration suites executed the current source. Existing services were not restarted, and the application database was not reset, reseeded, or migrated.

Source, integration tests, live API responses, browser behavior, database readbacks, and configured media delivery are separate evidence below. Production Firebase identity exchange/linking, other browser engines, physical mobile keyboards, and screen-reader behavior were not verified. Simulated error/empty responses prove UI feedback only.

## Repository and integration checks

| Check | Result |
| --- | --- |
| `pnpm check` | Passed; Astro checked 46 files with zero errors, warnings, or hints; API and UI TypeScript passed. |
| `pnpm build` | Passed; large-chunk warning also occurs on the parent revision. |
| `pnpm build:storybook` | Passed; large-chunk warnings also occur on the parent revision. |
| `pnpm check:design` | Passed; source ownership checks do not prove rendered behavior. |
| `pnpm check:guidance` | Passed, including the report and its incoming ledger link. |
| `pnpm db:validate` | Passed. |
| API `test:auth` | 13 passed using the Firebase Auth emulator and disposable PostgreSQL. |
| API `test:packages` | 11 passed, including service/canvas/media behavior with fake S3 storage. |
| API `test:messages` | 8 passed. |
| API `test:booking-requests` | 3 passed. |
| API `test:venues` | 4 passed. |
| Seed suite | 1 passed in a disposable database. |
| Canvas migration suite | 2 passed in disposable databases. |
| Flat catalog migration suite | 1 passed in a disposable database. |
| Catalog cleanup migration suite | 1 passed in a disposable database. |

The integration total is **44 passed, zero failed, zero skipped**. Suites cover role and ownership boundaries, session rotation/expiry/linking, stale/concurrent catalog updates, archive/delete rules, media ownership/cleanup/ranges, limits, pagination, booking snapshots/history/calendar filters, and message expiry/read state. This is coverage of the existing assertions, not every possible input or production provider behavior. Suite-created databases were checked after teardown and were absent.

All suite commands run from the root using `pnpm --filter @event-management/api test:<suite>` for the five named scripts. Additional suites use `pnpm --filter @event-management/api exec tsx --test tests/<name>.test.ts` with `seed`, `canvas-migration`, `flat-catalog-migration`, and `catalog-cleanup-migration`.

## Functional coverage

| Area | Evidence and outcome |
| --- | --- |
| Public site | Live packages, services, and venues loaded in order. Featured and View more collections opened detail previews; explicit close buttons returned to collections. Navigation and planning placeholder modal worked. Public layouts fit 320, 390, 768, and 1440px. |
| Public failure states | Intercepted catalog 503 displayed an error and retry; retry recovered the live list. An intercepted empty venue list displayed its empty state. These two states used response fixtures, not an actual provider outage. |
| Local authentication | Browser registration created one synthetic customer. Invalid credentials, password mismatch, duplicate registration, Show/Hide password, normal login, session restoration, account settings, and logout were exercised. Logout produced an anonymous `/me` response and stayed signed out after reload. Mobile authentication fit 390px. |
| Booking intake | Empty fields, custom event type, past date, exact duration minimum of eight days, error associations, focused error summary, and mobile dialog were checked. A signed-out draft survived authentication and required explicit review before submission. Two synthetic inquiries were submitted through the browser; the second resulted from an automation retry after a reference-text locator timeout. Both were confirmed in PostgreSQL. |
| Customer requests | Requests and package snapshots survived reload. Status history expanded. Cancellation required a reason; Keep request dismissed it; confirmed cancellation persisted. Admin acceptance appeared after customer reload. Booking language retained the distinction between an inquiry and a reserved/confirmed booking. |
| Messages | Browser sent a linked inquiry message, created a separate general chat, and sent from the Home dialog. Admin replied to the synthetic linked thread; customer polling received the reply. SQL confirmed both sides' linked messages had read timestamps. Linked details opened the correct accepted request and were read-only for customers. A simulated failed new-chat POST produced an alert toast. |
| Customer navigation and focus | Home, My events, Packages, Messages, and account settings worked. Account-menu Escape and message-dialog Escape restored focus; the message dialog initially focused its field. Four main views fit 320, 390, 768, and 1440px; selected screenshots were visually inspected. |
| Admin catalog CRUD | Own synthetic package, service, and venue records were created, previewed, edited, reloaded, archived, and deleted through the UI. Required-field and service-photo validation appeared. Existing records were not edited. |
| Catalog canvas | Markdown edit/preview and keyboard movement worked. Additional drag and resize changes, exact Markdown, and geometry survived Save/reload. Invalid text files produced photo/video errors. Package editor fit 320 and 390px; a 320px screenshot was inspected. Escape requested discard. |
| Photo upload | A generated 1px PNG uploaded through the UI. The saved service survived reload, and its archived admin preview returned media HTTP 200 and decoded at natural width 1px. The synthetic service was subsequently deleted. This proves the configured local API/storage path at the time of testing. |
| Video upload | An 8,025-byte generated WebM uploaded through the browser with HTTP 201. Autoplay opt-in persisted after Save/reload. Customer preview fetched a byte range with HTTP 206, decoded to `readyState=4`, and played muted to 1.08 seconds without a media error; it was paused by inspection. The editor preview was still loading at an earlier three-second observation; the subsequent customer preview played. Own fixture was deleted and its absence confirmed after reload. |
| Admin inquiry review | The synthetic latest inquiry moved `under_review` → `needs_details` → `accepted` with reasons. Browser and SQL showed both status-history transitions. Linked info and reply worked; the customer independently observed both. |
| Directory | Staff/customer filtering, search, and read-only detail drawers worked, including the new synthetic customer. Escape restored focus. Selected admin views fit 390px. |
| Staff workspace | Coordinator/head-waiter-style profiles exposed Events and Checklist; a waiter exposed Events only. Availability responses, checklist statuses, and notes were exercised. Reload restored demo state, as expected; these are not persisted staffing operations. |
| Demo overview and Schedule | Overview entry points opened the real booking queue or demo Schedule. Month/Week/Day changed Schedule content; sample event drawers and conflict dialogs opened, dismissed, and restored focus. Review reassignment closes its demo dialog. Handler-free overview and Schedule actions also exist on the parent revision. |
| Dormant demo modules | Inventory, Operations, and Reports are absent from `adminNav` in `apps/web/src/components/app/data.ts`; they were source-inspected, not presented as reachable, persisted product features. |
| Live API permissions | Anonymous/admin/staff/customer list reads returned the expected 401/403/200 matrix. Staff could read the admin inquiry queue but could not write catalogs, read the directory, or access admin messages. Customer-only lists rejected administrator/staff sessions. |
| Shared components | All 75 indexed Storybook stories loaded without page or console errors after excluding the temporary server's missing favicon. Eighteen interaction runs passed at 320 and 1280px, covering dialogs, drawers, tabs, pending buttons, and field states. |

No application page exceptions were captured in the tested browser journeys. Expected anonymous 401 responses, deliberately simulated 503 responses, and fixture-login 429 responses are distinct from JavaScript failures. Repeated isolated agent logins hit the account attempt limit; testing continued with another documented fixture without resetting the limiter.

## Findings

### F1 — Escape closes a detail and its parent collection

Reproduce for packages, services, or venues:

1. Open View more from the public site.
2. Open the first detail preview. Two native dialogs are open.
3. Press Escape. Both dialogs disappear, instead of returning to the collection.

The explicit preview close button leaves the collection open. Current Chromium and an isolated parent build reproduced this for all three catalog kinds. Inner cancel handlers in `PackagePreview.tsx` and `CatalogPreview.tsx` prevent the browser default without stopping propagation to `CatalogOverlay`'s handler in `PublicCatalog.tsx`. The callbacks are unchanged by the refactor. **Classification: pre-existing application navigation defect.**

### F2 — Form Controls story overflows at 320px

Open `Atoms/Controls` → `Form Controls` in the Storybook iframe at 320px. The native file input's intrinsic width expands the grid: the measured document/body width was 392px. The relevant example is `packages/ui/src/atoms/Controls.stories.tsx`, the `Input variant="plain" type="file"` row. This story was added by the refactor. **Classification: narrow Storybook example defect.** The application media dialog has separate styling; its checked mobile editor fit, so this result does not establish application overflow.

### Existing demo boundaries

Overview attention actions and View customer, plus Schedule's Check availability, Schedule event, previous/next month, and Today, have no handlers. Parent source has the same behavior. These controls remain demo placeholders, not verified operational features or new refactor regressions. Confirmed bookings, quotations, payments, availability enforcement, AI replies, and full workforce operations remain outside the implemented persisted journeys described by the root README.

## Synthetic data, cleanup, and evidence

Only clearly marked local QA business data was changed. Catalog fixtures used `QA-ADMIN-20261106-` names and were archived/deleted through the UI, including the photo fixture. The synthetic customer display name is `QA UI Refactor 20261106`, ID `d17229d8-66f7-4073-8c2e-f72141fab66e`.

- Inquiry `2512d374-3d43-40b8-b005-c199ddbc38e4`, reference `BR-1FE00CDD-2AEE-4148-AA9F-D83A9D953573`, was cancelled.
- Inquiry `063ee39f-2007-43de-b201-6f27f8f4709b`, reference `BR-9A708544-0B3F-439D-B939-0F088CBA7451`, exercised admin review and linked chat, then was cancelled through the customer API at cleanup.
- The synthetic account, inquiries, status histories, and three conversations have no normal delete UI and remain identifiable QA records. No SQL deletion of business history was performed.
- API helper sessions and final browser sessions were logged out. One stranded session belonging only to the newly created synthetic customer was revoked with the existing `deleteSessionByIdData` operation after checking its account identity; zero sessions remained for that account. Some earlier short-lived admin/staff browser contexts discarded their cookies before logout; their corresponding server sessions may remain until expiry. Existing users' sessions were not bulk-deleted.
- Final read-only SQL found zero package/service/venue records with the QA catalog prefix and no media-asset rows for either captured photo/video ID. This establishes application-record cleanup; remote storage was not separately listed to prove object deletion.

Sanitized command logs, browser check results, screenshots, read-only SQL outputs, and the isolated parent comparison were retained outside the repo in `/tmp/clemora-qa-checks-20261106`, `/tmp/clemora-qa-api-20261106`, `/tmp/clemora-qa-admin-20261106`, and `/tmp/clemora-qa-public-customer-20261106`. These temporary files are supporting evidence, not repository dependencies. Private cookies, passwords, environment values, and directory payloads were excluded from this report.

During baseline setup, one dependency-install command inadvertently ran in the original checkout and completed; Git remained clean afterward. No package/lockfile changes were retained. Temporary baseline servers were removed.

## Completion note

All delegated work returned and its consequential results were checked against source, logs, browser state, or database readback. The lead's retained public/customer checks contain 33 and 41 passing observations respectively; these observations overlap and are not a count of distinct product features. Shared-component checks add 75 story loads and 18 interaction runs. The two findings above remain open; this was a testing task, so application code was not changed.

The root README already distinguishes implemented workflows from planned and demo features; no product-scope or paper changes were needed. This report and its link from the existing refactor ledger are the only repository edits. Final `pnpm check:guidance` and `git diff --check` passed. The verified scope is the local implementation and tested boundaries described above, not production Firebase, cross-browser compatibility, exhaustive input combinations, or deferred business operations.
