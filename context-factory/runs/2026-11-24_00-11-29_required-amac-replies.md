# Required AMAC reply suggestions

Started: 2026-11-24T00:11:29+08:00
Updated: 2026-11-24T00:46:10+08:00
Status: complete
Scope: Implement and verify one to three optional replies on every new customer-facing AMAC message in local development.
Checkout: Integrated `16b404b3` into local `main` from `feat/required-amac-reply-suggestions`.
Continues: [AMAC suggested replies](2026-11-23_21-28-00_amac-suggested-replies.md)

## Result

Generated replies and the image worker share the same message writer. Reviews, receipts, and handoffs supply their own contextual options at the same validated insert boundary. The existing nullable column preserves legacy history. The handoff acknowledgement is identified by its successful saved tool call so both customer views can offer it even when AI is paused. A suggestion sends ordinary customer text and cannot authorize a booking submission.

Invalid suggestion metadata leaves the body intact. An optional copy-only model request can repair suggestions without calling tools. Local presets cover English, Filipino, Taglish, and Spanish when copy repair fails. Other languages can fall back to English if localized copy is unavailable.

## Verification

The assigned checkout serves Astro at `http://127.0.0.24:4731`, Edge on `58321`, and an isolated PostgreSQL and worker on `58322`. All 91 existing migrations are applied, including the existing suggestions migration. There is no new migration.

Guest browser reload restored both duration choices. Clicking **Multiple days** saved only that text and preserved the draft and staged image. The worker completed an image reply with uncertainty and clarification options, and the API blocked the sixth guest send. In signed-in chat, a review suggestion sent ordinary text, left the inquiry in draft, and ran no consent assessment. A typed date correction produced a fresh review. The pinned approval saved one receipt and one submission after a retry of the same customer message. The Spanish handoff option survived a fresh browser load and sent its exact text to staff with AI still paused. PostgreSQL showed one to three suggestions on all ten assistant rows in this stack.

Targeted API and Edge tests passed 181 cases with six opt-in provider cases skipped. The 80 web message tests and nine guidance tests passed. The full web type and structure checks and guidance links still report existing issues. Independent review covered writer, recovery, consent, handoff, and visibility behavior.

## Local main verification

At `http://localhost:4321`, both duration choices survived reload. Selecting the multiple-day option saved its exact text once with zero attachments. The API and PostgreSQL confirmed delivery. Both AMAC replies in that smoke test had saved suggestions. The synthetic conversation remains available locally. The root Edge build, API type check, 12 Edge tests, and focused web suggestion tests passed. The web process stayed up and the refreshed message worker runs separately from the dev launcher. Hosted rollout remains unverified.

## Resume here

Open **Messages** on local main and start a new conversation to retest. Previously saved replies keep their original suggestions.
