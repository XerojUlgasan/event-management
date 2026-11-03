# Clemora agents

Use these role guides with the area skills in the root [repository guidance](../../AGENTS.md). Read the relevant task references before doing that work; a role does not require every workflow on every task.

| Agent | Owns | Task references |
| --- | --- | --- |
| [Senior developer](senior-developer/AGENT.md) | Engineering planning, implementation, debugging, code review, ticket writing, and verification | All applicable [engineering skills](../engineering/README.md) and [shared principles](../shared/engineering-principles.md); code review; implementation, bug, spike, and Epic tickets |
| [Documentation](documentation/AGENT.md) | Repository documents, proposals, capstone papers, research, prose, and defense preparation | Capstone design and validation; research coordination and source review; document editing; prose polish; thesis examination; recursive review |

For work that spans both roles, use the senior developer guide to establish code and behavior evidence and the documentation guide to update affected documents. Preserve the distinction between intended scope, implemented behavior, and observed results.

Every change follows [investigate, understand, change, and verify](senior-developer/AGENT.md#investigate-understand-change-and-verify), including documentation and configuration edits. The senior developer owns technical investigation and verification; the documentation agent owns wording and source traceability. Verify inherited claims before repeating them, and distinguish the user's intended direction from what the current checkout implements.

Each agent has an `AGENT.md` entry point for standing instructions, a `memory.md` for lasting project knowledge, and a `reference/` folder for role-specific workflows and templates. Cross-cutting methods live in [engineering](../engineering/README.md); shared conventions live in `shared/`. Keep implementation detail in the existing API, frontend, packages, limits, and QA owners and link rather than duplicate it.

The senior developer must read the [operating contract](../shared/agent-workflow.md), principle digest, and engineering index on every task, load the full applicable skills, and audit their requirements before delivery. These files are manually readable canonical guidance; a client does not need automatic skill discovery to follow them. See the [context factory index](../README.md) and [adapters](../shared/skill-adapters.md) for local integration and verification limits.

## Memory

- [Senior developer memory](senior-developer/memory.md) keeps verified engineering lessons, architecture-decision pointers, recurring pitfalls, and useful verification commands.
- [Documentation memory](documentation/memory.md) keeps source-authority pointers, approved terminology and format decisions, research lessons, and unresolved evidence gaps.

At the start of work, read the selected role's memory and follow the entries relevant to the task. Read the other role's relevant notes when work spans both roles. Use memory as a guide to evidence: verify facts that may have changed against current code, tests, configuration, or authoritative documents before relying on them. Current user instructions and verified sources take precedence; correct a stale note when its replacement is established.

At completion, record a new lasting lesson or confirmed decision, refresh an existing entry, or remove an obsolete entry when the task supplies supporting evidence. Leave memory unchanged when there is nothing durable to add. Keep each entry short, give it a `YYYY-MM-DD` heading using the date last verified, and include the lesson or decision, supporting source links, and why it matters. State verification limits; label an unresolved question or evidence gap explicitly and record how to resolve it.

Keep shared decisions in their canonical project documents and link to them from either memory. Keep standing instructions in `AGENT.md` and reusable procedures in `reference/`. Merge repeated notes and remove superseded material so memory stays useful to read. Exclude full conversation logs, credentials, private fixture values, and sensitive personal data.
