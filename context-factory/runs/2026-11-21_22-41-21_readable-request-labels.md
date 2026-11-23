# Readable request and history labels

Started: 2026-11-21T22:41:21+08:00  
Updated: 2026-11-21T22:54:27+08:00  
Status: complete  
Scope: Replace generated IDs displayed in booking, chat, and notification views, private package history, Knowledge Catalog content, and the demo calendar. Verify the rendered flows and preserve lookups.  
Checkout: `main` at `67253d2`, with unrelated business-information work already present.  
Continues: [In-app notification bells](2026-11-21_12-13-39_notification-bells.md).

## Result

Booking views use event types, requested dates, contact names where appropriate, and readable accessibility labels. The submission receipt confirms review. Chat shows the stored preferred date as a civil date. Booking and conversation links retain their original identifiers.

The notification bell opts into booking display details. The API batches a recipient-scoped lookup using saved booking IDs, so older notifications receive the same labels as new ones where the booking is accessible. Missing or inaccessible bookings show a generic request label with any saved status. Historical payloads remain readable without a migration.

Private package history displays the current administrator name when available. Knowledge detail resolves included-service names at read time and applies a readable fallback to missing or archived services. Its display projection works with both saved and pending content without changing the embedding inputs. The demo calendar resolves its fixture to the event name.

## Verification

52 tests passed against individually migrated disposable PostgreSQL databases or pure fixtures. The focused web suites passed 66 tests. Web types, scoped lint, and guidance checks passed. Repository-wide checks reported existing failures in the guest-chat test types, the catalog utility boundary, and static design checks.

Chromium exercised the current web and API with an isolated migrated database. Checks covered admin booking labels, package history, Knowledge Catalog content, the demo calendar, submitted receipt, and customer event-to-chat navigation. Admin and customer notification clicks resolved the expected IDs. The drawer handled a missing booking and fit at 390 px with its close control visible.

## Resume here

Review the scoped local diff before rollout. The display changes require no migration or knowledge reindexing.
