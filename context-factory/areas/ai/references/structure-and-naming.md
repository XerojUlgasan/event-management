# AI structure and naming

Read [AI](../SKILL.md) for routing and [standards](standards-and-verification.md) for execution rules. This is the agreed placement for new AI work, not a claim that these application files exist. Start with the files required by the authorized slice; introduce the remaining responsibilities when needed.

## Placement

Keep the first assistant in `apps/api/src/services/ai/`. Its current consumers and business dependencies belong to the API. A separate workspace package becomes appropriate when a second real server consumer needs a shared implementation; it is not required to make the first agent modular.

```text
apps/api/src/services/ai/
├── run-assistant-turn.ts
├── assistant-context.ts
├── models.ts
├── agents/
│   └── create-customer-service-agent.ts
├── tools/
│   ├── list-public-packages.ts
│   ├── get-public-package.ts
│   └── get-my-inquiry.ts
├── prompts/
│   └── customer-service-prompt.ts
├── decisions/
│   └── classify-customer-message.ts
├── workflows/
│   ├── collect-inquiry-details.ts
│   └── request-human-handoff.ts
└── retrieval/
    ├── retrieve-approved-knowledge.ts
    └── embed-knowledge-text.ts
```

The [code examples](code-examples.md) demonstrate every file above. The full tree explains the available responsibilities; creating empty folders or unused functions is not part of adopting it.

The implemented customer-service agent lives in `agents/create-customer-service-agent.ts`; `tools/search-public-catalog.ts` owns the SDK definition, execution bounds, and audit lifecycle. `services/ai/search-public-catalog.ts` owns search validation, exact filtering, semantic freshness/ranking, pagination, and the small public projection. Focused query and audit operations live in `data/ai/`. The application entry retains trusted conversation scope and reply coordination; resulting tool-call links share the assistant-message transaction.

The implemented catalog knowledge slice keeps admin list/detail operations in
`services/ai/`, with shared source loading, freshness assessment, and hashing in
purpose-named files there. `workflows/` owns catalog preparation, transactional
synchronization, embedding refresh, and its separate after-commit scheduler.
`retrieval/` owns semantic search and embedding/image adapters. Search and admin
inspection share knowledge assessment rather than depending on a dashboard
builder. Queries live in operation-named files under `data/ai/`; import them
directly, with shared database/owner types in `catalog-knowledge-types.ts`.

| Owner                   | Responsibility                                                                                             | Keep elsewhere                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `run-assistant-turn.ts` | Public application entry; coordinate the authorized context, selected path, agent result, and turn outcome | HTTP parsing/response mapping in controllers; SQL in data                  |
| `assistant-context.ts`  | Narrow trusted runtime input, such as authenticated customer scope and provided dependencies               | Model-controlled identity/roles and raw client-supplied history            |
| `models.ts`             | Map configured model IDs to language, decision, and embedding roles; construct provider handles on use     | Env parsing/defaults in `src/utils/env.ts`                                 |
| `agents/`               | Compose a model, prompt, permitted tools, and bounded model-driven loop                                    | Domain rules, transactions, and direct SQL                                 |
| `tools/`                | SDK descriptions, input schemas, scoped execution, and small result projections                            | Duplicated package/inquiry/message business logic                          |
| `prompts/`              | Agent behavior and reusable prompt builders                                                                | Credentials, live prices, authorization, and authoritative business policy |
| `decisions/`            | Typed model assessments with explicit questions and criteria                                               | Permissions or binding business commitments                                |
| `workflows/`            | Application-controlled sequences, branching, and side-effect policy                                        | A second agent loop or wrappers that only forward arguments                |
| `retrieval/`            | Prepare search input, obtain approved evidence, and retain source identity                                 | SQL in data; document approval and publishing in their domain owners       |

Use `workflows/` for processes so the directory's meaning stays consistent. An agent chooses among tools; a workflow defines steps in code. A tool can call a workflow when the agent needs to select that process. The root entry already owns one turn's coordination; it needs no extra workflow file that merely repeats the same call.

## Keep existing layers

```text
HTTP controller
  → runAssistantTurnService
    → agent / selected workflow
      → scoped tools / typed decisions / retrieval
        → existing business services
          → domain data queries
```

- HTTP validation, sessions, OpenAPI, and response/stream mapping stay in `controllers/<domain>/`. Use `controllers/ai/` for a dedicated AI route family when needed, or the existing messages controller when that flow owns the operation. Update both Node and Edge registration for the chosen route; see [API structure](../../api/references/structure-and-routes.md).
- Tools call the existing package, inquiry, and message services with explicit trusted scope. Route middleware does not run when a tool calls a service directly. The optional customer argument of [get-booking-request.ts](../../../../apps/api/src/services/booking-requests/get-booking-request.ts) must be supplied by a customer tool.
- Kysely queries remain in `data/<domain>/`. Add `data/ai/` only for actual AI-owned persistence. Shared contracts and limits stay in `packages/contracts`; schema and migrations retain their existing owners.
- Environment names, validation, and defaults stay in [env.ts](../../../../apps/api/src/utils/env.ts). Model setup consumes that utility on use. Framework initialization remains at existing entry points.
- Put new AI behavior tests under `apps/api/tests/ai/`, with descriptive filenames such as `customer-inquiry-access.test.ts` or `assistant-turn.test.ts`. Existing domain suites continue to prove their domain behavior.

## Naming

| Item                                          | Convention                                          | Example                                  |
| --------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Folders and TypeScript files                  | kebab-case, responsibility-specific                 | `tools/get-my-inquiry.ts`                |
| Public application operation                  | verb + object, `Service` suffix                     | `runAssistantTurnService`                |
| Agent factory                                 | `create` + purpose + `Agent`                        | `createCustomerServiceAgent`             |
| Tool factory                                  | `create` + action + `Tool`                          | `createGetMyInquiryTool`                 |
| Tool key exposed to the model                 | Clear camelCase action                              | `getMyInquiry`                           |
| Internal workflow/decision/retrieval function | camelCase verb + object                             | `classifyCustomerMessage`                |
| Prompt value or builder                       | purpose + `Prompt`, or `build` + purpose + `Prompt` | `customerServicePrompt`                  |
| Types and schemas                             | PascalCase type; camelCase schema                   | `AssistantContext`, `inquiryDraftSchema` |
| Relative TypeScript imports                   | Existing NodeNext `.js` convention                  | `../models.js`                           |

Names should identify the action and audience: `list-public-packages`, `get-my-inquiry`, and `retrieve-approved-knowledge` reveal scope. Keep existing API names such as booking requests in their domain owners; a customer-facing inquiry tool can call them without renaming that domain. Avoid generic `manager`, `processor`, `helpers`, `common`, and `shared` files whose purpose is unclear.

Use normal imports and a deliberate tool map in the agent factory. Add registries, generic base agents, provider interfaces, or re-export layers only for an established need. Multiple agents can share tools and retrieval; group by agent later when independent behavior actually differs.

## Prompt files

Start with TypeScript strings or builders in `prompts/`. This works with the current Node entry and [Edge bundler](../../../../apps/api/scripts/build-edge.ts) without runtime filesystem reads or a new Markdown loader. Short operation-specific extraction instructions and decision criteria may remain beside their schema; extract reusable or substantial prompts into purpose-named files.

Prompts contain instructions, not current catalog facts. Supply retrieved evidence and user text as data, keep their provenance, and enforce access in code. If Markdown prompts become useful, first define their build-time loading and verify both runtimes.
