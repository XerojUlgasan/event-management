# AI structure and naming

Use this page to decide where a change belongs. Follow the [code walkthrough](code-examples.md) for runtime composition and [standards](standards-and-verification.md) for execution rules.

## Current owners

The assistant stays in `apps/api/src/services/ai/`, alongside its API consumers and business dependencies. Introduce a shared workspace package when a second real server consumer needs it.

| Owner                                                                                                                   | Responsibility                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [run-assistant-turn.ts](../../../../apps/api/src/services/ai/run-assistant-turn.ts)                                     | Application entry: authorized conversation/history, server context, turn identity/deadline, agent execution, and guarded reply coordination.                      |
| [assistant-context.ts](../../../../apps/api/src/services/ai/assistant-context.ts)                                       | Build the narrow timestamp/booking projection and eligible prior search continuation from server-loaded records.                                                  |
| [models.ts](../../../../apps/api/src/services/ai/models.ts)                                                             | Construct the text-model handle on use; configuration belongs to [env.ts](../../../../apps/api/src/utils/env.ts). Embedding setup lives in the retrieval adapter. |
| [agents/create-customer-service-agent.ts](../../../../apps/api/src/services/ai/agents/create-customer-service-agent.ts) | Compose the model, prompt, explicit tool map, and bounded SDK loop.                                                                                               |
| [tools/search-public-catalog.ts](../../../../apps/api/src/services/ai/tools/search-public-catalog.ts)                   | Adapt a capability to the SDK: description/schema, trusted dependencies, execution guards, audit lifecycle, and sanitized tool errors.                            |
| [search-public-catalog.ts](../../../../apps/api/src/services/ai/search-public-catalog.ts)                               | Search input validation, exact-filter semantics, optional semantic ranking, pagination, and small public result projection.                                       |
| [tools/get-public-catalog-item.ts](../../../../apps/api/src/services/ai/tools/get-public-catalog-item.ts) | Public detail tool, execution guards/audit, and Markdown model-output conversion. |
| [get-public-catalog-item.ts](../../../../apps/api/src/services/ai/get-public-catalog-item.ts) | Current public facts, ordered canvas projection, and bounded source-bound continuation. |
| [prompts/customer-service-prompt.ts](../../../../apps/api/src/services/ai/prompts/customer-service-prompt.ts)           | Reusable assistant instructions. Current facts arrive as context or tool results.                                                                                 |
| [retrieval/](../../../../apps/api/src/services/ai/retrieval/)                                                           | Embedding/image adapters and knowledge retrieval. Reuse source/freshness assessment without depending on an admin dashboard builder.                              |
| [workflows/](../../../../apps/api/src/services/ai/workflows/)                                                           | Application-defined catalog preparation, synchronization, refresh, and after-commit scheduling.                                                                   |
| [data/ai/](../../../../apps/api/src/data/ai/)                                                                           | Focused Kysely queries for knowledge/search and tool-call persistence; shared database/owner types stay here.                                                     |
| [create-assistant-message.ts](../../../../apps/api/src/data/messages/create-assistant-message.ts)                       | Existing message transaction, including final AI-state guard and links from completed tool calls to the saved reply.                                              |

## Extending the assistant

Customer-only [getMyProposal](../../../../apps/api/src/services/ai/tools/get-my-proposal.ts) uses an empty input schema and server-bound conversation/customer scope. Its [service](../../../../apps/api/src/services/ai/get-my-proposal.ts) reuses the owned booking-package read and returns complete sections/widgets as JSON. The SDK adapter preserves full Markdown while auditing bounded result identity/count metadata; the agent shares call and remaining proposal-result character budgets. Guest turns never receive this tool.

Automatic [interpretMessageImage](../../../../apps/api/src/services/ai/tools/interpret-message-image.ts) is an SDK tool invoked by [message preparation](../../../../apps/api/src/services/messages/prepare-message-images.ts), with bytes and authorized conversation scope bound on the server. The vision service owns model interpretation; the adapter owns its execution audit. It runs independently of chat AI state and uses conversation/source-message audit links because interpretation precedes message persistence. It does not appear in the chat agent's optional tool map.

1. Define the capability's audience, allowed inputs, result, and failure behavior using the relevant business rules. Determine which values are model choices and which must come from the authorized turn.
2. Put domain behavior in the existing domain service. Use `services/ai/` for AI-specific orchestration/search policy and `data/<domain>/` for SQL. Reuse these owners rather than copying business rules into an SDK callback.
3. Add a purpose-named tool factory under `tools/` when the model must choose that capability. Bind trusted dependencies when constructing it, then register its camelCase key explicitly in the agent's `tools` map. Keep tool use model-selected from the first step. Update descriptions and prompt instructions for source selection and interpretation.
4. Extend the existing turn entry and audit path as needed. A new tool does not require another HTTP endpoint, agent, or generic registry. Add public contracts or UI only when the authorized consumer needs them.

Route middleware does not execute when a tool calls a service directly. Pass trusted owner scope to domain services and inspect their checks; for example, a customer tool calling [getBookingRequestService](../../../../apps/api/src/services/booking-requests/get-booking-request.ts) must supply its customer argument.

An agent chooses tools; a workflow defines steps in code. Add a workflow for a concrete multi-step responsibility, and a separate decision module only when a typed model assessment improves the flow. Neither folder provides durable execution. Do not create unused classifiers, handoff adapters, or placeholder trees.

HTTP validation, sessions, OpenAPI, and response mapping stay with the existing controller family. Follow [API structure](../../api/references/structure-and-routes.md) if route registration changes, including Node and Edge. Model credentials/configuration stay server-side in the existing env owner. Behavior tests belong under `apps/api/tests/ai/`; domain suites retain their own responsibilities.

## Naming and imports

Use kebab-case files named for their operation, such as `tools/search-public-catalog.ts`. Follow existing exports: `runAssistantTurnService`, `createCustomerServiceAgent`, `createSearchPublicCatalogTool`, `searchPublicCatalog`, and `customerServicePrompt`. Tool names should communicate action and audience; service exports retain their domain terminology. Use normal direct imports with the existing NodeNext `.js` suffix.

Keep prompts as TypeScript strings/builders so Node and Edge can load them without runtime filesystem access. Add a registry, base agent, provider abstraction, or Markdown loader only for a demonstrated need, and verify affected runtimes.
