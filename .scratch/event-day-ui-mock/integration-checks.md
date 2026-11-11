# Booking-request page integration

Verified locally on 11 November 2026 (Asia/Manila), working tree based on `main` at `53b9a63`.

The approved mock is integrated at `/app/bookings/{id}` for System Administrators. Booking-table rows and admin conversation details navigate there. Customer My events and conversation details retain the time-editing modal. Shared components, theme tokens, limits, and existing API clients are reused; no API or schema change was required.

## Verification

- `pnpm check`: web, API, and UI checks passed with no diagnostics.
- `pnpm build`: passed; Vite reports a chunk over its 500 kB warning threshold.
- `pnpm exec tsx --test ../web/tests/*.test.ts` from `apps/api`: nine tests passed, including the new route, role, and safe login-return cases.
- `pnpm check:guidance` and `git diff --check`: passed.
- Browser: local Astro frontend at `localhost:4321`, existing `/v1` proxy to the running local Edge API. Admin and customer development fixtures were exercised sequentially.
- A new QA inquiry was accepted through the page. Applying deadlines created the ready operational day, skipped the date without times, and retained selection. A staff API response was saved without changing the booking revision; the page refresh retrieved it.
- Browser writes confirmed helper/coordinator roles, cancelled an assignment, reopened responses, moved a day to a different date, navigated to its replacement, and cancelled that replacement. Original requested times remained visible.
- Customer My events and linked-conversation modals retained eligible time editing and exposed no admin status controls. Customer-saved times appeared on the admin page; applying deadlines again opened that newly ready date.
- A signed-in customer could not enter the admin route. Admin sign-in returned to the requested detail link. Missing request recovery, reloads, dialog Escape/focus restoration, and a 390 px mobile layout were checked. No horizontal page overflow was observed.
- The QA inquiry was cancelled through the frontend with a required reason. A subsequent API read confirmed cancellation and cancelled operational schedules. Temporary API sessions were logged out and their credential files removed. Existing seeded inquiries were not mutated.

This is local browser/API evidence, not a hosted deployment or provider check. Legacy manual scheduling retains its existing API/form and was source-reviewed; no legacy record was created or changed during live QA.

## Review

Terra implemented the day workspace and a separate Terra reviewer inspected the integration. Review caught and resolved explicit day-refresh invalidation and locking between request controls and day mutations. Luna checked consumers and updated the owning README/frontend references. No review work remains outstanding.

Desktop and mobile captures are `integration-desktop.jpg` and `integration-mobile.jpg` beside this note. The original mock remains separate from application code.
