# Contextual customer Home preview

Started: 2026-11-23T16:52:15+08:00
Updated: 2026-11-23T17:07:00+08:00
Status: complete
Scope: Implement and verify signed-in customer Home in the isolated room branch. The parent owns room processes and the tunnel.
Checkout: `.room/customer-home`, `codex/customer-home-preview`, based on `eb6c10a6aa262648c230339100976e4aee15798e`.
Continues: [Single-row conversational booking](2026-11-22_00-39-41_single-row-booking-drafts.md)

## Result

The welcome and hero retain their existing content and actions. **Your next step** uses one action for the latest open request needing details, the newest actionable unread quotation, the latest unfinished booking draft, the latest open request, closed history, or first-time planning, in that order. Request dates are labeled as requested. A failed load offers a retry.

The customer-only conversations list accepts `includeLatestBookingDraft=1` and returns the latest owned, linked and unsubmitted draft as its conversation ID and optional event type. Standard conversation responses and My events retain their existing booking projection. No migration was needed. [Home action selection](../../apps/web/src/lib/services/customer-home/next-step.ts) · [Draft data query](../../apps/api/src/data/messages/find-latest-customer-booking-draft.ts)

## Verification

- Twenty-five web tests passed across Home selection, inbox paging, alerts and quotations. Twelve conversational booking and draft migration tests passed on disposable databases in the room cluster, plus twelve Edge route/auth tests. The opt-in live AMAC model test was skipped.
- Chromium exercised the rebuilt local production preview connected to the room Node API. It covered the five Home actions, exact targets, a first message persisted across reload, draft exclusion from My events, loading and retry after an injected API failure, and requested dates. At 390px and 1280px the card fit the viewport. A separate synthetic booking proved that replacing a displayed quote refreshes the action, after which the current version opens and only its alert is marked read.
- API type, changed-file lint, environment and guidance tests passed. Repository-wide Astro, structure, design and guidance checks report existing diagnostics in unrelated formatting, catalog/media and historical guidance files. Hosted and live AI behavior were outside this preview.

## Resume here

Use the existing `customer-home` room and its matching web build. For future API source changes, coordinate a room restart with the parent before repeating the signed-in checks.
