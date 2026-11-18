# AI standards and verification

Use [structure and naming](structure-and-naming.md) for ownership and the [code walkthrough](code-examples.md) for composition. The root [README](../../../../README.md#current-implementation) owns capability status and configuration; the matching [business references](../../../business/README.md) own intended business rules.

## Trusted context and access

- Resolve identity, conversation, triggering message, and allowed capabilities on the server. Never ask the model to supply a conversation/customer ID or role for access control. Any model-selected record ID still needs an ownership check. Direct service calls bypass route middleware.
- Load authorized history from storage, preserving roles and human/assistant provenance. Supply server context as data; customer text, retrieved content, and tool output cannot replace system instructions. Validate any client-provided history before use.
- Preserve conversation activity, AI-version, and ownership guards before/after tool work and at reply commit. Human takeover, including an off/on cycle, invalidates an unfinished turn. Suppressing that reply is a normal outcome.
- Validate tool arguments with the owning schema and relevant shared limits. Return small explicit projections; exclude unrelated records, credentials, and unnecessary contact data. Prompts guide behavior; code enforces access and side effects.
- Use fresh domain records for prices and status. Supplied references must correspond to actual evidence. A catalog result or booking inquiry does not establish availability, a final quotation, a reservation, or a confirmed booking.

<a id="catalog-tool-execution-and-audit-records"></a>

## Tool-call persistence

[ai_tool_calls](../../../../apps/api/prisma/schema.prisma) stores executions separately from chat messages. Follow the existing [tool adapter](../../../../apps/api/src/services/ai/tools/search-public-catalog.ts) and focused [data operations](../../../../apps/api/src/data/ai/):

- Keep one row per invocation, identified by unique `(turn_id, tool_call_id)`. `turn_id` identifies a server-created attempt; `tool_call_id` comes from the SDK; `tool_name` identifies the registered capability. Retries must not conflate separate attempts.
- Bind the required `customer_message_id` on the server. `assistant_message_id` is optional until a reply is committed. Both message relationships are many-to-one: one triggering message and one resulting reply can each have multiple calls. Database checks enforce message roles and same-conversation links.
- Save validated input, bounded projected output or a sanitized error code, status (`started`, `succeeded`, `failed`), and timing. The current path records calls that reach execution; schema-invalid proposals and oversized rejected batches do not get execution rows. Audit rows are server-only.
- Start tracking before domain work and finish it after success/failure. A tracking failure must block publishing an untracked result. Preserve the turn-level fatal flag: SDK tool errors can enter model context and the model may still produce text.
- Link completed rows for the turn and trigger atomically with assistant-message creation using [linkToolCallsToReplyData](../../../../apps/api/src/data/ai/link-tool-calls-to-reply.ts). Keep model/provider calls outside database transactions.
- Allow an absent reply after provider failure, cancellation, or takeover. A terminated process can leave a `started` row. These records are audit evidence, not durable jobs, automatic retries, or proof that a customer received an answer.

For pagination context, reuse only validated inputs and a cursor from a successful call linked to an earlier saved assistant reply in the same owned conversation. Never replay saved prices as fresh results. See [assistant-context.ts](../../../../apps/api/src/services/ai/assistant-context.ts) and [get-last-catalog-search.ts](../../../../apps/api/src/data/ai/get-last-catalog-search.ts).

## Execution and model configuration

Read the installed `ai` package's version-matched `docs/` and `src/` before changing SDK use. Inspect [package.json](../../../../apps/api/package.json), [models.ts](../../../../apps/api/src/services/ai/models.ts), and [env.ts](../../../../apps/api/src/utils/env.ts); validate optional configuration on use so unrelated routes still load. When introducing/changing a model, verify its exact ID and capabilities in the live Gateway catalog and honor the user's selection.

Bound history/context, result size, output tokens, loop steps, tool invocations, and elapsed time. Retain a path to a final answer and forward cancellation to model/retrieval/tool operations. The [entry](../../../../apps/api/src/services/ai/run-assistant-turn.ts), [agent](../../../../apps/api/src/services/ai/agents/create-customer-service-agent.ts), and [tool](../../../../apps/api/src/services/ai/tools/search-public-catalog.ts) own the current limits; inspect them when extending the tool map because step limits alone do not bound calls in a batch.

Handle invalid input, no matches, access denial, unavailable evidence, refusal, tool/provider failure, timeout, and empty replies explicitly. Unavailable search must not become a successful empty search. Sanitize errors entering model context or HTTP responses. Set retries/fallbacks deliberately within the deadline; never silently substitute models. Log bounded operation IDs, model role, latency, counts, outcome, and usage without keys, raw private history, or unrestricted provider bodies.

For a new mutation or handoff, first define authorization/consent, ownership, persisted state, delivery meaning, concurrency, and replay protection. Draft extraction is distinct from submission; a typed model assessment is distinct from permission. Long waits require explicit durable state/resume behavior. The existence of a workflow function or audit row does not supply it.

## Retrieval and knowledge

Enforce audience visibility in the query/adapter before evidence enters model context. Catalog ingestion and admin inspection include records that customers cannot see; their eligibility rules cannot authorize public search. The [public search service](../../../../apps/api/src/services/ai/search-public-catalog.ts) and its data query enforce the customer-facing policy while reusing compatible embedding and freshness operations.

Retain source identity and freshness; exclude withdrawn, stale, pending, or incompatible evidence. Model, dimension, or preprocessing changes need an explicit reindex/query transition. Bound excerpts and deduplicate listing results. Read the root README and [ingestion decision](../../../history/decisions/2026-11-16_catalog-embedding-ingestion.md) when changing source preparation or scheduling. New business-information sources require an approved content owner and visibility policy before use.

## Verification

Inspect [package scripts](../../../../apps/api/package.json), [API verification](../../api/references/verification.md), and test setup/targets before running checks. Choose checks that could expose the changed mistake:

| Changed responsibility | Closest evidence                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Model/configuration    | Environment checks, API types, lazy/missing configuration and unrelated route imports.                                                                                                                                                                                                                                                                                         |
| Tool/service/query     | Exact filters, malformed inputs, public/archived/private eligibility, minimal results, pagination, empty versus unavailable search; [search tests](../../../../apps/api/tests/ai/search-public-catalog.test.ts).                                                                                                                                                               |
| Tool-call storage      | Multiple calls per trigger/reply, distinct attempt/call identities, failed/unfinished rows, reply-link atomicity, role/conversation constraints, client denial; [storage tests](../../../../apps/api/tests/ai/tool-calls.test.ts).                                                                                                                                             |
| Turn/agent/prompt      | Tool dispatch, context provenance, tracking failure, budgets, cancellation, takeover, and final reply; [assistant tests](../../../../apps/api/tests/ai/assistant-turn.test.ts), plus guest cases in [guest-chat.test.ts](../../../../apps/api/tests/guest-chat.test.ts). Representative live-model cases are separate evidence for selection, language, and grounding quality. |
| Retrieval/ingestion    | Source/freshness/embedding compatibility, audience filtering, invalidation and provider failure; relevant suites under [tests/ai](../../../../apps/api/tests/ai/).                                                                                                                                                                                                             |
| Mutation/workflow      | Draft versus submitted state, ownership, consent, concurrent/replayed requests, persisted outcome, and failure recovery.                                                                                                                                                                                                                                                       |
| UI/contracts           | Affected contracts, frontend/packages reuse audit, and rendered loading/error/partial states and browser flow.                                                                                                                                                                                                                                                                 |
| Guidance only          | `pnpm check:guidance`, `pnpm test:guidance`, scoped formatting, and affected [routing scenarios](../../../routing-checks.md).                                                                                                                                                                                                                                                  |

For API code, run `pnpm --filter @event-management/api check` and focused behavior tests; verify Edge when imports or route registration change. Add contract/frontend checks when their consumers change. Do not invent scripts or run database fixtures before inspecting their side effects and target.

Use synthetic models/providers for deterministic orchestration checks. Live calls, embeddings, notifications, database changes, and external writes require authorization for their actual side effects/cost; documentation work does not authorize them. Report source, types, fixtures, API, database, browser, provider, and Gateway-log evidence separately. Guidance checks establish navigation/structure, not runtime behavior or future agent compliance.
