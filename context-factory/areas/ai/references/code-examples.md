# Current assistant code walkthrough

These links describe the implemented path. Inspect the linked source when changing it; the snippets explain composition without supplying a second implementation. Use [structure and naming](structure-and-naming.md) for ownership and [standards](standards-and-verification.md) for invariants.

## How the model knows its tools

The [customer-service agent factory](../../../../apps/api/src/services/ai/agents/create-customer-service-agent.ts) passes an explicit map to `ToolLoopAgent`. Its registration has this shape; the actual factory also supplies its proposal-budget guard:

```ts
tools: {
  searchPublicCatalog: createSearchPublicCatalogTool(options),
}
```

The map key is the tool name the model can request. The SDK sends that name, its description, and its input schema with the model request. The model chooses a tool and generates arguments. The SDK validates those arguments, runs the server's `execute` callback, and supplies its result to the next model step so the agent can answer. The model receives the callable interface; the database handle and executable server code stay on the server.

## A tool's three parts

Open [tools/search-public-catalog.ts](../../../../apps/api/src/services/ai/tools/search-public-catalog.ts):

| Part          | Purpose in this tool                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `description` | Tell the model when to search and how to interpret filters, service pricing, pagination, and results. Descriptions guide usage; they do not enforce access.                    |
| `inputSchema` | Define and validate model-supplied arguments. The shared search schema lives with [searchPublicCatalogService](../../../../apps/api/src/services/ai/search-public-catalog.ts). |
| `execute`     | Use bound server dependencies, track the invocation, check turn activity, call the service, and record a projected result or sanitized failure.                                |

For example, a request for a package within a budget can supply `catalogType: "package"`, `pax`, and `maxPricePesos`. A service search uses its pricing type when filtering price; package capacity does not apply. Optional `query` enables semantic ranking; omitted `query` browses by exact filters. A continuation reuses the filters/query with the returned cursor. The service owns these semantics and result limits.

The factory closes over the database, triggering message ID, turn ID, and activity/persistence guards. Customer identity and conversation scope come from the application entry's server-side checks. They are not fields the model fills in.

## One turn, from message to reply

1. The existing Messages flow calls [runAssistantTurnService](../../../../apps/api/src/services/ai/run-assistant-turn.ts) with server-resolved identity and conversation/message IDs. The entry verifies ownership, active conversation state, and AI version, then loads ordered history through the triggering customer message.
2. [assistant-context.ts](../../../../apps/api/src/services/ai/assistant-context.ts) builds current server context. Guests receive no private booking projection. Eligible previous search inputs/cursors can support continuation; stored search prices do not become current evidence.
3. The entry creates a turn ID and an agent with scoped dependencies. The [agent factory](../../../../apps/api/src/services/ai/agents/create-customer-service-agent.ts) selects the configured model and [prompt](../../../../apps/api/src/services/ai/prompts/customer-service-prompt.ts), registers tools, and sets loop/call budgets.
4. When the model selects search, the tool records its start and calls [searchPublicCatalogService](../../../../apps/api/src/services/ai/search-public-catalog.ts). That service composes the current public catalog query and optional compatible, fresh indexed evidence. [data/ai/search-public-catalog.ts](../../../../apps/api/src/data/ai/search-public-catalog.ts) owns listing/filter SQL, while [data/ai/search-catalog-knowledge.ts](../../../../apps/api/src/data/ai/search-catalog-knowledge.ts) owns semantic vector search. The service returns a bounded listing projection.
5. The tool checks activity again and records success or failure. The model can use successful evidence to answer. After generation, the entry checks fatal tracking errors and validates the reply; [createAssistantMessageData](../../../../apps/api/src/data/messages/create-assistant-message.ts) rechecks AI state and saves the reply with completed-call links in one transaction.

Read [execution-record rules](standards-and-verification.md#tool-call-persistence) before adding another tool. The [accepted search decision](../../../history/decisions/2026-11-18_catalog-search-and-tool-calls.md) records why pagination, public visibility, and execution tracking have these boundaries.
