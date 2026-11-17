# AI standards and verification

Use [structure and naming](structure-and-naming.md) for placement and [code examples](code-examples.md) to understand composition. These rules apply to the implemented slice; the examples are not a production contract or an instruction to enable all capabilities.

## Product and source authority

The root [product scope](../../../../README.md#product-scope) permits factual answers from approved information, inquiry collection, and human handoff. Administrators retain quotation and commitment decisions. Read the matching [business references](../../../business/README.md) when a tool touches a domain; this guide does not settle open business decisions.

The first implementation uses `ai@7.0.173` for automatic text replies to customer Messages and anonymous public inquiries. It saves the customer message, reads ordered conversation history through that message, supplies a fresh server-built timestamp/timezone and customer-owned linked booking-request projection (or no booking context for a guest), generates a reply, and saves an explicit `assistant` message with no human sender ID. The JSON context is data, is not persisted as a message, and shares the bounded input budget with history. See the root [implementation status](../../../../README.md#current-implementation), [context builder](../../../../apps/api/src/services/ai/assistant-context.ts), and [AI entry](../../../../apps/api/src/services/ai/run-assistant-turn.ts). Conversation AI defaults on. Successful admin messages and quotation delivery atomically disable it; only an explicit admin toggle resumes future replies. A saved AI version invalidates unfinished replies after takeover, including off/on cycles. Suppressed replies are a normal outcome, not a provider error. The public `searchPublicCatalog` tool is implemented for signed-in and guest turns; it supports exact package/service filters and optional current catalog retrieval. Decision calls, private tools, business-information retrieval, inquiry drafts, and automated handoff requests remain unimplemented. Admin search is separate. Before extending draft submission or handoff, define its ownership, lifecycle, persistence, and replay behavior. Preserve historical migrations.

Confirm knowledge sources and their approval/publishing owner, handoff ownership, intake/submission fields, and any guest-access scope before implementing behavior dependent on them. Continue independent work within the known scope while missing decisions are resolved. A booking inquiry does not reserve a date, establish a final price, or confirm a booking.

## SDK, Gateway, and configuration

Read the installed API package version and its bundled `ai/docs/` and `ai/src/` before writing SDK code. Verify each API and provider capability rather than translating remembered LangChain or older SDK examples. Use the existing SDK agent loop; add another framework only for a stated capability that warrants it.

The user's selected model roles are:

| Env name          | Selected Gateway ID                 | Role                                                |
| ----------------- | ----------------------------------- | --------------------------------------------------- |
| `TEXT_MODEL`      | `deepseek/deepseek-v4.1-flash-1017` | Replies, language reasoning, and tool selection     |
| `DECISION_MODEL`  | `typesafe-ai/jev-1.14.0`            | Typed decisions through `experimental_decide`       |
| `EMBEDDING_MODEL` | `google/gemini-embedding-2`         | Catalog text/photo embeddings, fixed 768 dimensions |

The text and decision selections were recorded from the [public model catalog](https://ai-gateway.vercel.sh/v1/models) on 2026-11-16. The user selected `google/gemini-embedding-2` for catalog ingestion later that day; the earlier `google/gemini-embedding-001` selection is superseded for this role. A catalog listing or selected ID is not proof of key validity, account access, or a successful call. Recheck exact IDs/modalities when adding or changing model use; honor the selected models rather than silently substituting others.

Read `AI_GATEWAY_API_KEY` and model settings through [the API env owner](../../../../apps/api/src/utils/env.ts). Keep credentials and runtime clients on the server. Validate optional AI configuration on use so unrelated routes remain available. The examples' grouped `env.AI` getter is proposed, not present source; narrow configuration requirements if an implemented capability uses fewer model roles.

AI SDK 7 supports `ToolLoopAgent`, `tool`, structured output, embeddings, and typed decisions. Jev uses `experimental_decide`, not `generateText`. The installed docs take precedence over this dated example; deprecated evaluation names may appear in older guidance. References: [agents](https://ai-sdk.dev/docs/agents/building-agents), [Gateway provider](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway), [decisions](https://vercel.com/docs/ai-gateway/modalities/decision), and [embeddings](https://vercel.com/docs/ai-gateway/modalities/embeddings).

## Context, tools, and access

1. Authenticate and validate the caller's role in server code before constructing trusted context. Load history for an authorized conversation and preserve message roles and provenance. If history arrives from a client, validate its structure and allowed origin; a supplied `system` message or tool result is not trusted history.
2. Bind customer identity, role-derived capabilities, and conversation scope on the server. Expose only the necessary tools. The model may supply an inquiry ID, but it cannot select the customer ID or elevate its role. Customer tools must preserve ownership checks on every read and write, including calls that bypass HTTP middleware.
3. Validate tool inputs with authoritative schemas/limits where they exist, and validate provider output before using it for application state. SDK/TypeScript types do not prove semantic correctness. Keep draft extraction distinct from submission, and model assessments distinct from permission checks.
4. Return small, explicit tool projections. Keep contact details, private messages, credentials, and unrelated records out of provider context. Use fresh domain services for current catalog prices and inquiry status; an embedding index is not a second authority for live records.
5. Treat customer text, retrieved documents, and external tool content as untrusted data. Keep system instructions server-owned. Prompt wording helps behavior; code enforces allowed sources, actions, access, and side effects. References in an answer must correspond to evidence actually supplied.

## Catalog tool execution and audit records

The customer-service agent exposes only `searchPublicCatalog`; trusted message, conversation, identity, AI version, and turn IDs are bound in server code. It checks ownership and active AI state before and after search. The shared deadline is 30 seconds; the loop has at most four steps with the last step reserved for text, six searches, and twelve recorded proposals. Oversized batches cannot execute or write audit rows. Invalid tool inputs fail SDK validation before execution and are not stored. Search output contains at most five unique public listings and bounded excerpts, never full canvases or private records.

`ai_tool_calls` stores validated execution inputs, projected public results or sanitized error codes, and timing. Its message FKs are many-to-one; `(turn_id, tool_call_id)` distinguishes individual invocations across attempts. Resulting-message links commit atomically with reply creation. Missing/failed tracking prevents publishing an untracked result. Successful calls may lack a reply after provider failure or takeover; interrupted processes may leave started rows. Rows are server-only audit evidence, not replay jobs or customer chat messages. Previous successful search inputs/cursors are supplied only when a linked reply predates the current customer message in the same owned conversation; saved prices are not replayed as current facts. See the [accepted decision](../../../history/decisions/2026-11-18_catalog-search-and-tool-calls.md).

## Decisions and workflows

Use a separate decision call when its typed classification or score improves the required flow. It is optional; one language agent may already handle a bounded tool choice. Define criteria, representative cases, and application handling for uncertain or refused results. Model probabilities are not calibrated authorization or proof of correctness.

Workflows own explicit sequences and state transitions. A handoff draft must say it is unsubmitted; successful delivery requires a real persisted or provider-confirmed result. Mutation tools need a defined consent/authorization path and concurrency/replay protection. Keep transactions at their domain owners and avoid holding database transactions open during model calls. For long waits or human approval, define durable state and resume behavior before choosing a runtime; a `workflows/` folder alone does not provide durability.

## Retrieval and knowledge

Catalog ingestion is implemented separately from retrieval. Its approved sources are non-archived catalog packages and all non-archived services; custom packages and customer/booking/conversation records are excluded. Publishing is not an additional ingestion filter. Future retrieval must settle and enforce customer visibility before exposing this corpus. The [ingestion decision](../../../history/decisions/2026-11-16_catalog-embedding-ingestion.md) records the accepted slice.

Overview chunks retain current listing facts and active service names. Markdown chunks retain original text in widget slices of at most 6,000 Unicode code points, with listing/section context. Each photo embeds actual uploaded or allowlisted sample bytes together with listing/section context, alt text, and caption; WebP is converted to PNG through `imagescript`, and video is skipped. The fixed model is `google/gemini-embedding-2`, with normalized 768-dimensional vectors.

Catalog transactions reconcile derived rows without provider or Storage calls. Source hashes include projection/media identity and preprocessing/model settings; final hashes also include actual embedding input bytes. Changed rows receive new IDs, and workers reconcile current source under owner/dependency locks before staging and saving through ID/hash compare-and-swap. Matching source hashes preserve vectors. Service rename/archive invalidates dependent package overviews. Provider failure leaves retryable pending state without failing a committed catalog save.

After-commit refresh coalesces each owner and runs at most two owner jobs per process, with a 120-second owner budget and 30-second Storage/provider limits. Edge registers tasks with `EdgeRuntime.waitUntil`; this does not supply durable scheduling or survive every platform shutdown. The sequential `pnpm --filter @event-management/api catalog:embed` command reconciles all eligible owners, prunes ineligible rows, and retries pending work without the background owner budget. Admin search is implemented independently. The public assistant search adapter reuses embedding/freshness operations while enforcing its own public eligibility, listing deduplication, exact filters, and scoped pagination. See the root [configuration](../../../../README.md#configuration) before authorized provider or database operations.

Admin semantic search is an explicit-submit diagnostic at `POST /admin/ai/knowledge/search`, restricted to system administrators. It embeds text queries using the existing model and 768 dimensions with the `task: search result | query:` prefix, preserving document ingestion formatting. A consistent snapshot excludes custom/archived owners, incompatible embeddings, and pending, stale, or withdrawn chunks before returning the top five by cosine similarity. It includes unpublished catalog listings for admin inspection and does not establish customer visibility. Source freshness uses the same metadata/digest assumptions as the dashboard; search does not re-download photos. Exact ranking currently scans candidates and should be revisited if catalog size warrants it.

- Select approved sources and public/private access policy before ingestion. Raw interviews, repo guidance, demo content, and historical proposals are not automatically public customer knowledge.
- Enforce approval, visibility, and actor scope in the storage/query adapter before results enter model context. A function name or a model filter is not access control. Empty results are valid; access failures and unavailable search must not be silently treated as successful grounded answers.
- Store source identity/version and keep embeddings compatible by model, dimensions, and relevant preprocessing/task settings. Model or dimensionality changes require an explicit reindex/query transition. Preserve provenance when chunking and invalidate withdrawn or superseded sources.
- Bound chunk count and content size. Report missing evidence honestly; use current domain services for live facts. An optional unconfigured search path can answer through available catalog tools, but it cannot claim policy/document coverage.

## Failure handling, budgets, and observability

Give each turn a bounded history/context budget, tool-result size, generation output, step count, and elapsed-time budget suited to its runtime. Forward cancellation through model/retrieval calls and any cancellable tool operation. Step limits bound loops; they do not guarantee a final text answer or cap every kind of cost.

Define observable handling for invalid input, unauthorized/missing records, no evidence, provider refusal, tool failure, timeout/cancellation, rate limits, unavailable credentials/credits, and exhausted steps with empty text. Handle tool failures or incomplete outputs before returning success. Map these outcomes through existing HTTP/error conventions; avoid exposing raw provider payloads. Streaming needs explicit error/partial-result and disconnect behavior.

Set retries and fallbacks deliberately. Account for SDK defaults, extra decision calls, and per-step tool calls. Retry transient reads only within the turn budget. A mutation or external notification can be replayed only through an operation with appropriate durable idempotency; a transaction by itself does not deduplicate a lost-response retry. Do not silently switch the selected model or repeat an unsafe action.

Record sanitized operation/request IDs, selected model role, latency, step/tool counts, outcome, and usage when supplied. Apply the same privacy rules to every role and telemetry path. Keep keys, raw private prompts/history, contact data, and unrestricted tool/provider bodies out of logs, traces, reports, fixtures, and committed artifacts.

## Verification

Inspect the current [package scripts](../../../../apps/api/package.json) and the [API verification guide](../../api/references/verification.md) before running checks. Match proof to the changed behavior:

| Changed responsibility     | Closest useful evidence                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Models/configuration       | `pnpm check:env`, API type check, and focused lazy/missing-config behavior; existing unrelated route imports still work                                                                     |
| Tool access and projection | Deterministic tests: own/other customer, missing/unpublished/archived records, malformed inputs, minimal outputs; relevant domain integration suite when behavior changes                   |
| Agent/decision/prompt      | Representative cases for tool selection, grounding, language, classification, refusal, and unsupported requests; deterministic fixtures can verify orchestration but not live model quality |
| Workflow/mutation          | Draft versus submitted result, authorization, rollback, duplicate requests, stale/concurrent writes, and retry/partial-failure behavior                                                     |
| Ingestion                  | Eligible/private/archived owners, unchanged inputs, photo bytes/context, media cleanup, service dependencies, failed retries, stale workers, and Node/Edge background limits                |
| Retrieval                  | Approval/access filtering, source withdrawal, incompatible embeddings, empty/unavailable results, provenance, and bounded context                                                           |
| HTTP/stream/runtime        | API validation/status/role handling, Node and Edge route parity, cancellation/stream failure; build plus actual served runtime when claiming runtime compatibility                          |
| AI UI                      | Frontend/packages reuse audit, affected contracts, rendered loading/error/partial states, and relevant browser flow                                                                         |
| Guidance only              | `pnpm check:guidance`, `pnpm test:guidance`, scoped formatting, and the affected [routing scenarios](../../../routing-checks.md)                                                            |

For API implementation, run `pnpm --filter @event-management/api check` and the focused behavior tests; build/check Edge integration when imports or route registration change. Inspect integration-test setup and target before DB-backed runs. Add shared contracts/frontend checks only when those consumers are affected. Do not invent an AI test script that is absent from the package.

Use synthetic provider/model fixtures for bounded deterministic checks. Live model calls, evaluation batches, knowledge embedding, notifications, and external writes require task authorization for their side effects and cost. Documentation work does not authorize them. Report exact artifact/environment and whether evidence is source, types, fixtures, API, database, browser, live provider, or Gateway logs. Guidance checks establish navigation and metadata, not model quality, runtime behavior, or future agent compliance.
