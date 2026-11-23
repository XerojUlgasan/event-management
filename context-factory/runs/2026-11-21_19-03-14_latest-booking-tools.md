# Latest quotation and request status tools

Started: 2026-11-21T19:03:14+08:00
Updated: 2026-11-21T19:16:00+08:00
Status: complete
Scope: Implement two customer chat reads and verify live tool selection, replies, and audit records with disposable fixtures.
Checkout: main at dd534cd, initially clean.
Continues: [Conversation memory](2026-11-21_13-28-31_conversation-memory.md) and [direct quotation sending](2026-11-21_00-49-10_direct-quotation-send.md).

## Result

`getMySentQuotation` returns the current delivered offer, using the existing customer-facing quotation line items and converting amounts to pesos. `getMyRequestHistory` returns the latest recorded status change and customer-visible reason. Both tools bind to the signed-in customer's conversation and linked inquiry. The prompt calls for fresh reads on initial and follow-up questions. Audit rows carry version or status metadata and link to the triggering message and saved reply.

## Verification

- The 85 assistant, guest, proposal, and tool-call tests passed with live evaluation enabled. Isolated local PostgreSQL databases and API handlers exercise revised offers, a newer draft, a status change during an active turn, missing records, invalid scope input, and guest claim.
- The configured Gateway model completed four fixture questions. Each turn performed one matching read with a successful reply-linked row in `ai_tool_calls`. Earlier probes caught a centavo interpretation error and an incomplete final reply. The tool now supplies pesos and the prompt asks for the complete answer after tool calls. The model can still refer to clearly labeled historical chat. The lookup payload contains only the latest record.
- All 22 quotation tests and 11 booking-request tests passed. Focused API types, isolated Edge bundling, and scoped lint passed. The full API type check reports the existing `PoolClient.processID` error in the guest test.
- Independent review approved the implementation and latest attribution checks after the prompt and test corrections.

## Resume here

The live case is in [assistant-turn.test.ts](../../apps/api/tests/ai/assistant-turn.test.ts). Enable it with `AMAC_LIVE_TOOL_TESTS=1` and the configured Gateway model. Quotation delivery pauses AI until an admin resumes it. Hosted rollout remains separate.
