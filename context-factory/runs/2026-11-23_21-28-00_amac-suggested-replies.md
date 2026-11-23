# AMAC suggested replies

Started: 2026-11-23T21:28:00+08:00
Updated: 2026-11-23T21:53:00+08:00
Status: complete
Scope: Implement and verify AMAC suggestions in the assigned worktree. Integration, shared databases, and publishing are outside this run.
Checkout: `feat/amac-suggested-replies`, based on `15b39023`.
Continues: [Natural booking conversations](2026-11-22_01-10-04_natural-booking-chat.md)

## Result

AMAC generates a message and contextual customer replies in the conversation language. The API validates the final reply and stores its suggestions on the message. The web app reuses its shared Button and existing send flow. Clicking sends the exact label once in that view and leaves draft text and staged attachments intact. Both chat surfaces handle delayed old turns and use the available send allowance. Admin chat renders the assistant text without suggestion controls.

The selected provider skipped a native booking tool when its JSON response mode was enabled. The final implementation keeps the native tool loop, validates the final envelope in the SDK, and preserves clean plain text with an empty suggestion list. Server-written booking reviews, receipts, and handoff acknowledgements keep their own text.

## Verification

Astro at `http://127.0.0.23:4631` proxied to this worktree's rebuilt Edge bundle on `57321` and isolated PostgreSQL on `57322`. The database had 91 finished Prisma migrations, including `20261123173000_assistant_suggested_replies`. The configured live Gateway produced Spanish guest and Taglish customer suggestions. Browser reloads restored choices, rapid clicks sent one exact message per chat, and database readback showed no attachment on either click. Staged draft text and images remained in the composer. The admin browser showed the same signed-in thread without the saved buttons. Disposable database fixtures verified delayed and legacy replies in the browser and were removed after the check.

The five targeted API suites passed 159 cases with six opt-in cases skipped. The live Taglish booking regression corrected and submitted its reviewed draft once. Two later live runs returned an unavailable reply during approval. The 80 web message tests, 12 Edge checks, and guidance unit tests passed. Automated fixtures covered quota, image jobs, malformed model output, and repeated approval. The full Astro and web structure checks report existing errors in `money.ts` and `use-thumbnail.ts`. The guidance link check reports two missing targets in an older proposal-tool run.

## Resume here

Await the head's explicit integration instruction. Then apply the additive migration to the authorized local target, rebuild Edge and refresh its message worker, and repeat the guest and signed-in browser checks. Hosted rollout remains unverified.
