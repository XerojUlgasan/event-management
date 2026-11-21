# AMAC AI business information

Started: 2026-11-21T21:54:31+08:00
Updated: 2026-11-21T22:00:22+08:00
Status: complete
Scope: Enable current public business information reads for guest and customer conversations, including live model verification.
Checkout: main at 67253d2 with the existing uncommitted business profile implementation.
Continues: [Missing business information](2026-11-21_21-54-30_missing-business-information.md)

## Result

The customer-service agent exposes `getBusinessInformation` from its first model step. The tool calls the same service as the public API and projects the ten basic fields from the editor and footer. Only populated fields enter the model context. Missing rows, blank profiles and profiles with only older fields all yield `not_configured`. Reads leave an absent row untouched. The first admin save makes its details available on the next lookup.

The prompt asks for a fresh lookup on relevant follow-ups. An unavailable read has its own failure result. Executed calls share the existing turn guards and budgets. Their audit stores the status and field names and links to the saved reply.

## Verification

Disposable PostgreSQL chat tests exercised guest and signed-in use, first admin save, edits, empty data, sanitized read errors and audit linkage. In a separate authorized Gateway run, the configured AMAC model chose the tool once on each of three turns. It supplied the first email, supplied the replacement after an edit, and reported no listed email after deletion without repeating either address. The shared application profile was left untouched.

The local Edge bundle built successfully. The full API type check still reports the pre-existing `PoolClient.processID` error in the guest test.

## Resume here

The opt-in case is in [assistant-turn.test.ts](../../apps/api/tests/ai/assistant-turn.test.ts). Run the test named “live AMAC model rereads business information across changes and removal” with `AMAC_LIVE_TOOL_TESTS=1` to repeat the provider check. Hosted deployment remains separate.
