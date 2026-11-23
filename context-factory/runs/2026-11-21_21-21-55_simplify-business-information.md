# Simplify business information

Started: 2026-11-21T21:21:55+08:00
Updated: 2026-11-21T21:52:00+08:00
Status: complete
Scope: Ten basic admin fields and a shared public footer; preserve stored data and unrelated workflows.
Checkout: main, 67253d2; existing uncommitted business-information feature retained.
Continues: [Business information implementation](2026-11-21_21-06-32_business-information.md)

## Goal

Keep name, short introduction, phone/email, Facebook/Instagram, address/map, service areas, and opening hours. The user confirmed these basics, then replaced the separate public page with footer placement. Policies, inquiry/booking guidance, FAQs, extra links, and other fields leave these views.

## Result

The admin editor has ten fields in four sections, shared controls, one opening-hours textarea, and a footer preview link. PublicDocument renders BusinessInformationFooter across homepage/catalog/detail routes. Empty fields stay hidden. Failed, malformed, or timed-out profile reads retain the compact brand/navigation footer. Reads time out after three seconds; public documents use no-store. `/about` redirects 301 to `/#business-information`; navigation, homepage CTA, sitemap, and admin copy follow that placement.

Full-document saves preserve excluded values, expectedUpdatedAt conflicts, pending/error behavior, and workspace draft retention. Excluded values remain in the public API response; hiding them does not make them private. README owns current scope.

## Changes or findings

Two native Terra medium explorers traced patterns/reuse. Cursor Composer 2.5 standard workers implemented the admin and public compositions; the lead integrated layouts, links, and checks. Requested routes were accepted; execution-model metadata was unavailable. No substitutions. The predecessor writer's draft-retention fix and regression were preserved through coordinated file ownership.

Independent Grok high review held save, empty-state, route, escaping/link, and failure-isolation paths. Its three CSS findings were repaired in cycle 1: multiline text preservation, mobile paragraph spacing, and focus contrast. Fresh recheck 52dfb7eb-e670-473e-93dc-63c78a9c8eed approved final CSS SHA-256 `132bf840343ff5ef9febf5b2d59c24ffb755f5fc323caf034494a6052c177337`.

## Verification

Passed: 15 helper/DOM/SSR tests, eight navigation tests, web check/build, scoped lint/format, nine guidance tests, and diff checks. Authenticated admin browser checks covered ten labels, responsiveness, and invalid-email feedback without a save. Local HTTP verified shared footers/no-store, preserved 404s, redirect, and sitemap. Isolated built SSR with synthetic API data passed populated, empty, 503, malformed, and stalled-read cases; task-created services stopped afterward.

Live screenshot frames became unavailable. Standalone actual-component/built-CSS renders with synthetic data verified final desktop/mobile layouts and multiline spacing; only unrelated viewport-height rules were neutralized for the frame. No business records changed; fixture login was logged out.

## Decisions

Reuse shared UI/theme exports; domain composition stays app-owned. No dependency, migration, reset, commit, push, or deployment in this UI refinement.

## Remaining work

None within this UI scope. Full repository checks retain unchanged catalog utility-boundary and catalog/message design failures. Hosted rollout and live browser persistence were not tested.

## Resume here

Review the local diff before any release. Preserve the confirmed basic-field/footer scope and predecessor backend work; apply no shared migrations or service changes without rollout authorization.
