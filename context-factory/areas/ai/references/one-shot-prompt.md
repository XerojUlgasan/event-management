# One-shot AI task prompt

Use this example when assigning a first bounded implementation slice. Replace the outcome and acceptance cases for the actual task; keep its authorization and exclusions explicit. Read [AI](../SKILL.md), [structure and naming](structure-and-naming.md), [standards and verification](standards-and-verification.md), and the [code examples](code-examples.md) before adapting it. Copying this document into the repository does not start an implementation.

## Example prompt

```text
Implement the first signed-in, read-only customer catalog assistant in this
repository. Follow AGENTS.md -> context-factory/README.md -> areas/ai/SKILL.md
and its applicable references, API guidance, and the implementation workflow.
Read the current README for scope and actual implementation status.

Outcome:
- A signed-in customer can POST a single text message to /v1/ai/reply and
  receive a grounded text answer using published package information.
- Use the existing Vercel AI SDK and AI Gateway. Read the installed SDK docs
  and verify the selected TEXT_MODEL supports the required tool calls.
- Define the request/response and reachable error outcomes using existing
  Hono/OpenAPI conventions. Scope this slice to one message without persisted
  chat history or client-supplied system/tool messages.
- Keep the public application entry in services/ai/run-assistant-turn.ts.
  Compose one customer service agent with listPublicPackages/getPublicPackage
  tools that call the current public package services with bounded projections.
- Put model setup, the prompt, and tool definitions in the agreed locations.
  Extend the existing typed env owner only for settings this slice actually
  uses. Missing AI configuration must not break unrelated API imports/routes.

Scope and authority:
- Inspect branch, revision, dirty worktree, callers, current services, tests,
  contracts, Node registration, and Edge dispatch before edits. Preserve
  unrelated changes, including pre-existing environment example changes.
- This prompt authorizes the described application changes and focused local
  verification. It does not authorize billable model calls, DB data changes,
  notifications, deployment, commits, or pushing.
- Keep inquiry submission, private inquiry tools, Jev routing, embeddings/RAG,
  handoff, guest access, and UI outside this first slice. Do not create unused
  folders or wire every example merely because it is documented.
- Keep quotation changes and commitments with the administrator. Missing
  evidence must produce an honest answer, not an invented price or promise.

Acceptance and proof:
- Verify unauthenticated/non-customer rejection, published-only tool results,
  bounded outputs, invalid input, tool failure, unavailable model configuration,
  cancellation, and step-limit/empty-answer handling at the relevant seams.
- Use synthetic provider responses to exercise orchestration without spending
  credits. Clearly distinguish that proof from live model behavior.
- Register the route for both Node and Edge and verify affected API types,
  configuration checks, focused behavior, and Edge build/runtime as applicable.
- Inspect test side effects before execution; use actual package scripts.
- Update affected current docs and create/update this work's own run, linking
  the relevant predecessor without rewriting an earlier run. Report the final
  diff, checks and evidence boundaries, skipped checks, and remaining decisions.

Proceed with routine implementation choices inside this scope. If a missing
business decision affects correctness, identify it and continue independent
work that does not depend on the answer.
```

For a planning-only assignment, replace the implementation authorization and acceptance work with a read-only investigation and proposal. For a later feature, name the actual new behavior and its permission/persistence/verification requirements instead of silently expanding this initial slice.
