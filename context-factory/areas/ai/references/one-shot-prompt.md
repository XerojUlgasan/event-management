# Scoped AI extension prompt

Use this template when assigning work on the existing assistant. Replace the bracketed fields with the actual task and authorization; the template grants no actions by itself.

Use [structure and naming](structure-and-naming.md) to place the change, the [code walkthrough](code-examples.md) to trace integration, and [standards and verification](standards-and-verification.md) to choose invariants and acceptance checks.

```text
Outcome: [customer need and expected observable behavior].
Authorized scope: [implementation/review/investigation, affected capability, allowed side effects].

Start with AGENTS.md and context-factory/README.md. Read the AI area's structure,
current code walkthrough, and standards; select API/business/auth/contracts/UI
references only when their task conditions apply. Verify current branch, diff,
source, callers, configuration, and tests; preserve unrelated work.

Trace the existing Messages → runAssistantTurnService → customer-service agent
path. Extend the responsible owner rather than creating a parallel assistant.

Capability contract:
- Audience and access: [guest/customer/admin; ownership and conversation boundaries].
- Model arguments: [choices the model may make and their validation].
- Server-bound values: [identity, conversation/message/turn scope and dependencies].
- Result and failures: [minimal projection, empty/unavailable behavior, action meaning].
- Persistence: [existing execution records; any new state and replay requirements].

Follow the existing explicit tool registration and execution-record lifecycle when
adding a callable tool. Let the model choose whether it needs tools for the message.
Keep domain behavior in services and SQL in data. Resolve missing business decisions
before enabling dependent behavior.

Acceptance: [representative success, access, invalid input, failure, cancellation,
takeover, and multiple-call cases relevant to this change]. Run the closest checks
from the standards guide, inspect affected docs and the final diff, and report
what each check proves plus remaining limits. Use synthetic providers unless live
calls are explicitly within the task's authorization.
```

Choose concrete acceptance cases for the capability. For example, a new conversation-bound read needs proof that the model cannot select another conversation, that private data stays scoped, and that its calls link correctly when one reply uses several tools. Do not request unrelated drafts, handoff, UI, decisions, or retrieval simply because the architecture can support them.
