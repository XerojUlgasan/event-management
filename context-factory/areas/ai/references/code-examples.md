# Current assistant code walkthrough

These links describe the implemented path. Inspect the linked source when changing it; the snippets explain composition without supplying a second implementation. Use [structure and naming](structure-and-naming.md) for ownership and [standards](standards-and-verification.md) for invariants.

## How the model knows its tools

The [customer-service agent factory](../../../../apps/api/src/services/ai/agents/create-customer-service-agent.ts) passes an explicit map to `ToolLoopAgent`. This excerpt shows public catalog and private proposal registration:

```ts
tools: {
  searchPublicCatalog: createSearchPublicCatalogTool(toolContext),
  getPublicCatalogItem: createGetPublicCatalogItemTool(toolContext),
  // Registered only when the turn has trusted customer/conversation scope:
  ...(options.customerScope
    ? {
        getMyPackage: createGetMyPackageTool({
          ...toolContext,
          proposalScope: options.customerScope,
        }),
      }
    : {}),
}
```

The map key is the tool name the model can request. The SDK sends tools' names, descriptions, and input schemas with the model request. From the first step, the model can answer directly or choose tools available to the current conversation. The SDK validates arguments, runs the server's `execute` callback, and supplies results to the next model step. The database handle and executable server code stay on the server.

A direct answer does not require a tool call or create an execution record. Actual calls retain their SDK invocation IDs and pass through the existing audited adapters. Source choice and interpretation remain model decisions, which synthetic dispatch tests cannot prove correct.

## A tool's three parts

Open [tools/search-public-catalog.ts](../../../../apps/api/src/services/ai/tools/search-public-catalog.ts):

| Part          | Purpose in this tool                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description` | Tell the model when to search and how to interpret filters, service pricing, pagination, and results. Descriptions guide usage; they do not enforce access.                    |
| `inputSchema` | Define and validate model-supplied arguments. The shared search schema lives with [searchPublicCatalogService](../../../../apps/api/src/services/ai/search-public-catalog.ts). |
| `execute`     | Use bound server dependencies, track the invocation, check turn activity, call the service, and record a projected result or sanitized failure.                                |

For example, a request for a package within a budget can supply `catalogType: "package"`, `pax`, and `maxPricePesos`. A service search uses its pricing type when filtering price; package capacity does not apply. Optional `query` enables semantic ranking; omitted `query` browses by exact filters. A continuation reuses the filters/query with the returned cursor. The service owns these semantics and result limits.

The factory closes over the database, triggering message ID, turn ID, and activity/persistence guards. Customer identity and conversation scope come from the application entry's server-side checks. They are not fields the model fills in.

[getPublicCatalogItem](../../../../apps/api/src/services/ai/tools/get-public-catalog-item.ts) uses `catalogType`, a public catalog UUID, and optional continuation cursor. Its [service](../../../../apps/api/src/services/ai/get-public-catalog-item.ts) reads current facts and ordered canvas content without embeddings. The execution record stores `{ markdown, nextCursor }`; `toModelOutput` sends the Markdown as text to the model. Pages are bounded and cursors bind the rendered source, including visible linked references. The tool does not generate legacy service-role lists or recursively expand linked canvases. Both catalog tools share the turn's execution budget.

## One turn, from message to reply

The customer-only [getMyPackage adapter](../../../../apps/api/src/services/ai/tools/get-my-package.ts) takes no model arguments. Its server-bound scope identifies the conversation; the [service](../../../../apps/api/src/services/ai/get-my-package.ts) verifies ownership and reads the current domain proposal. The model receives structured JSON containing full original `sections[].widgets[]`, without a Markdown text conversion. Normal missing-request/unprepared results are distinct from access/read failures. Audit output contains status, result hash/size, and package/section/widget metadata rather than copied private text. Proposal results share the remaining context/history character budget and fail explicitly if they cannot fit. An in-flight guest claim does not add customer capabilities to the original guest turn.

[getLatestQuotation and getBookingDetails](../../../../apps/api/src/services/ai/tools/get-my-booking-facts.ts) use the same signed-in scope. They check conversation and inquiry ownership before reading customer records. The quotation read returns the latest delivered version and converts stored centavos to pesos. The booking read returns the submitted request with saved add-ons and its most recent recorded status change. Their audit rows record result status and version or change metadata. The system prompt calls for a current-turn lookup on applicable initial and follow-up questions.

1. Only image-containing messages commit a durable `process_image_message` job with the human message. The [Node handler](../../../../apps/api/src/services/background-jobs/handlers/process-image-message.ts) validates and interprets saved images, then calls [runAssistantTurnService](../../../../apps/api/src/services/ai/run-assistant-turn.ts) for an eligible customer/guest turn with captured server-resolved identity, conversation/message IDs, AI version and the current job lease. Text-only customer/guest sends call the same assistant service in the synchronous request after an abortable wait of up to five seconds for earlier image jobs; timeout leaves the message saved and returns `assistantError` without queueing the text turn. This wait covers earlier image jobs only; it does not serialize concurrent text turns or later image messages. The entry verifies ownership/activity and loads causal history through the trigger, including completed earlier-trigger replies even when those replies were saved after this message arrived. Later customer turns remain excluded.
2. [assistant-context.ts](../../../../apps/api/src/services/ai/assistant-context.ts) builds current server context. Guests receive no private booking projection. Eligible previous search/detail inputs and cursors can support continuation; saved prices and Markdown do not become current evidence. The entry labels previous assistant messages as historical claims and places current context beside the latest customer message, preserving the full history and its provenance.
3. The entry creates a turn ID and an agent with scoped dependencies. The [agent factory](../../../../apps/api/src/services/ai/agents/create-customer-service-agent.ts) selects the configured model and [prompt](../../../../apps/api/src/services/ai/prompts/customer-service-prompt.ts), registers tools, and sets loop/call budgets.
4. The model can answer directly or select a tool. For search, the adapter records its start and calls [searchPublicCatalogService](../../../../apps/api/src/services/ai/search-public-catalog.ts). That service composes the current public catalog query and optional compatible, fresh indexed evidence. [data/ai/search-public-catalog.ts](../../../../apps/api/src/data/ai/search-public-catalog.ts) owns listing/filter SQL, while [data/ai/search-catalog-knowledge.ts](../../../../apps/api/src/data/ai/search-catalog-knowledge.ts) owns semantic vector search. The service returns a bounded listing projection.
5. Each called tool checks activity again and records success or failure. The model can use successful evidence or explain a sanitized read failure. After generation, the entry checks fatal tracking errors and validates the reply; [createAssistantMessageData](../../../../apps/api/src/data/messages/create-assistant-message.ts) rechecks the job lease and AI state, reuses an existing trigger-linked reply, or saves it with completed-call links in one transaction. The unique trigger is shared with handoff acknowledgements. Polling delivers the saved outcome independently of the original send request.

Read [execution-record rules](standards-and-verification.md#tool-call-persistence) before adding another tool. The [accepted search decision](../../../history/decisions/2026-11-18_catalog-search-and-tool-calls.md) records why pagination, public visibility, and execution tracking have these boundaries.

## Conversation memory

[Conversation memory data](../../../../apps/api/src/data/messages/conversation-memory.ts) loads the private Markdown note and checks the latest customer trigger in the same database snapshot. The turn supplies the note as fallible context alongside saved messages. [updateConversationMemory](../../../../apps/api/src/services/ai/tools/update-conversation-memory.ts) proposes a complete bounded replacement during the normal tool loop. The write uses the conversation lock and rechecks the trigger, owner, AI version and previously read note. It records a compact audit result. An older turn can still answer from its own saved history. Guest claim preserves the note through the existing conversation row.

## Human handoff mutation

The [requestHumanHandoff adapter](../../../../apps/api/src/services/ai/tools/request-human-handoff.ts) accepts the shared reason/summary schema and binds the current turn's conversation, customer/guest identity, triggering message, and AI version. Its [service](../../../../apps/api/src/services/ai/request-human-handoff.ts) validates input; the [transaction owner](../../../../apps/api/src/data/messages/request-human-handoff.ts) locks and revalidates the conversation, saves the latest JSONB metadata, disables AI, saves the fixed acknowledgement, and completes/links the execution record atomically. Repeated invocations for the same trigger reuse the acknowledgement. Tracking failure rolls back the mutation.

This successful mutation owns its reply commit. The turn captures the committed acknowledgement and cancels further generation/queued calls, returning that saved message even after the resulting SDK cancellation. It must not use the ordinary final reply guard after switching AI off. Stale turns, including human off/on cycles, cannot start a new handoff. Preserve guest expiry and captured identity scope. See [message policy](../../../business/messages.md#ai-requested-human-review) for pending-state and admin UI behavior.
