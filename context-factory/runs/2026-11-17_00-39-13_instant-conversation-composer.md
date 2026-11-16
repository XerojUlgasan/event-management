# Instant customer conversation composer

Started: 2026-11-17T00:39:13+08:00
Updated: 2026-11-17T00:41:00+08:00
Status: complete
Scope: Approved implementation after screenshot review; no commit, push, deployment, shared-data reset, or migration requested.
Checkout: main at bae1d6e; initially clean. Changes remain uncommitted.
Continues: [Anonymous conversation](2026-11-16_23-55-00_anonymous-conversation.md)

## Goal

Make anonymous and signed-in customer chat feel immediate: own bubbles and cleared/refocused drafts on submission, Enter to send, Shift+Enter for a new line, a stable arrow, continued typing/sending during AI requests, and per-message retry feedback.

## Result

Both customer composers use local outboxes reconciled against saved message IDs. The logged-in composer is compact, and the home message dialog opens Messages without waiting for AI. Admin send behavior remains unchanged. Guest quota and expiry rejections explicitly mark unsaved bubbles; multiline text is preserved.

## Changes and decisions

- Signed customer sends accept an optional UUID request ID and use it as the message ID. Matching retries return the saved message without another write, state change, or model call. Conflicting reuse returns 409.
- New guest message IDs also equal request IDs, allowing polling during unresolved sends. Historical reservation replays retain their original IDs. No schema or migration changes are needed.
- Guest pending requests reserve local allowance slots. Polls and late responses reconcile identities and retain server history order without restoring stale allowance.
- Outboxes are in memory. Reload discards unconfirmed bubbles; saved messages remain in server history. Existing draft retention is limited to the mounted Messages workspace. Interrupted AI turns still have no durable retry worker.

## Verification

- API agent: messages 10/10, synthetic AI 14/14, guest chat 13/13; disposable PostgreSQL and mock model only.
- Integrated web message helpers: 27/27. Workspace checks and web/API/Edge builds passed; the existing large-bundle advisory remains.
- Browser with intercepted synthetic API responses: desktop/mobile composers, rapid sends, reversed replies, exact retry identities, draft preservation, thread isolation, polling before a lost response, guest fifth-message gating and stale-quota rejection, home-dialog submission, and sign-in recheck on guest reopen. No live provider or real customer send was used for this implementation check.
- Independent Luna source review found a quota-rejection bubble defect; it was fixed and verified in the browser. The lead also kept signed-in failure feedback visible if a thread becomes read-only and fixed sign-in rechecking when reopening a guest chat with an uncertain send.
- Final web check/build and formatting passed. Guidance navigation and 9 structural tests passed; affected UI, contract, documentation, and continuation routes were walked. The design detector reported only existing style advisories outside this change. The running local Edge OpenAPI includes the new customer request ID field. Browser viewport and temporary tabs were restored/closed.

## Resume here

Review the combined uncommitted diff, starting with the customer/public composers and message data queries. README owns current behavior. Deploy matching API and browser code together so request IDs reconcile correctly; hosted behavior remains unverified. Screenshots are in this chat's visualization directory. No further implementation work is pending for the approved slice.
