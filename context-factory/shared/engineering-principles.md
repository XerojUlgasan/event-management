# Engineering principles

Read this digest on every engineering task. Apply its standing rules throughout the work, and read the full linked skills whenever their conditions apply. A task can trigger several principles; the digest is a selector, not a substitute for their methods. The [senior developer](../agents/senior-developer/AGENT.md) checks applicability at startup, on scope changes, and before delivery.

Every task preserves the user's full outcome and authorization, investigates before changing, uses the owning source and contracts, avoids unrelated edits, and verifies the actual artifact at the claimed boundary. A small task uses a small process. A conditional method does not require benchmarks, architecture prototypes, tests, or a retrospective when that work is irrelevant.

| Full skill | Rule and when to apply it in Clemora |
| --- | --- |
| [Attack the premise](../engineering/principle-attack-the-premise/SKILL.md) | After two fixes fail the same gate, test their shared premise before a third. Confirm the running checkout/API target before blaming edited source. |
| [Boundary discipline](../engineering/principle-boundary-discipline/SKILL.md) | Parse at trust boundaries and keep typed internal logic clear. Route validation does not replace permissions, current-state checks, or database constraints. |
| [Build the lever](../engineering/principle-build-the-lever/SKILL.md) | Use a small rerunnable tool for complex/repeated edits or hard-to-inspect proof. A simple edit does not need new infrastructure. |
| [Encode lessons in structure](../engineering/principle-encode-lessons-in-structure/SKILL.md) | Turn recurring demonstrated mistakes into ownership, types, an actionable check, or a behavior test. Reserve prose for judgment. |
| [Exhaust the design space](../engineering/principle-exhaust-the-design-space/SKILL.md) | Compare distinct designs/prototypes for a novel consequential choice. Follow existing patterns for routine changes. |
| [Experience first](../engineering/principle-experience-first/SKILL.md) | Judge product/API/UI choices by the consumer's complete journey, including errors, accessibility, and accurate inquiry wording. |
| [Explain the number](../engineering/principle-explain-the-number/SKILL.md) | Before reporting measured performance/evaluation, verify completed work, correctness, spread, and the actual limiter. |
| [Fix root causes](../engineering/principle-fix-root-causes/SKILL.md) | Reproduce a bug and repair the first wrong decision. Do not hide a bad producer with retries or silent data loss. |
| [Foundational thinking](../engineering/principle-foundational-thinking/SKILL.md) | Establish data shapes, invariants, access patterns, ownership, and concurrent writers before dependent logic. |
| [Guard the context window](../engineering/principle-guard-the-context-window/SKILL.md) | Bound reads and retain concise evidence/next actions across long tasks. Do not substitute summaries for uninspected source. |
| [Laziness protocol](../engineering/principle-laziness-protocol/SKILL.md) | Make the smallest sufficient change with one owner per decision. Preserve required layers and the complete outcome. |
| [Make operations idempotent](../engineering/principle-make-operations-idempotent/SKILL.md) | Define replay and crash recovery for repeatable writes/processes. A transaction alone does not deduplicate lost-response retries. |
| [Migrate callers, then delete legacy APIs](../engineering/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | Change internal contracts and callers coherently; coordinate independent deployments and bound any compatibility period. |
| [Minimize reader load](../engineering/principle-minimize-reader-load/SKILL.md) | Remove unnecessary indirection and hidden mutable state while preserving meaningful controller/service/data responsibility. |
| [Model the domain](../engineering/principle-model-the-domain/SKILL.md) | Represent real states/invariants explicitly. Keep review status, conversation status, archives, and booking confirmation distinct. |
| [Continue authorized work](../engineering/principle-never-block-on-the-human/SKILL.md) | Resolve routine choices and continue. Ask about material missing policy or authorization; do not infer availability/confirmation rules. |
| [Outcome-oriented execution](../engineering/principle-outcome-oriented-execution/SKILL.md) | For planned migrations, keep the final outcome intact and local temporary breakage isolated behind explicit verification boundaries. |
| [Prove it works](../engineering/principle-prove-it-works/SKILL.md) | Before completion, inspect the actual artifact. Distinguish source, tests, API, database, browser, and provider proof. |
| [Redesign from first principles](../engineering/principle-redesign-from-first-principles/SKILL.md) | Reconsider the owning shape when a new requirement repeatedly creates workarounds. Deliver the scoped solution incrementally. |
| [Separate before serializing shared state](../engineering/principle-separate-before-serializing-shared-state/SKILL.md) | Isolate independent writes; enforce genuinely shared invariants with transactions/constraints or other structural coordination. |
| [Sequence verifiable units](../engineering/principle-sequence-verifiable-units/SKILL.md) | Verify each meaningful unit before dependent work and keep delivered contracts/callers coherent. |
| [Subtract before you add](../engineering/principle-subtract-before-you-add/SKILL.md) | Remove supported obsolete paths within scope before building the replacement; preserve migration history and unrelated work. |
| [Test behavior, not implementation](../engineering/principle-test-behavior-not-implementation/SKILL.md) | Tests must fail on observable breakage and survive an equivalent internal refactor. Use the actual local test setup. |
| [Type system discipline](../engineering/principle-type-system-discipline/SKILL.md) | Derive from authoritative schemas/contracts and parse unknown values. Handwritten browser types do not validate server JSON. |

These 24 skills retain the source toolkit's individual principles with local examples and explicit scope boundaries. The [engineering index](../engineering/README.md) records provenance and task workflows. The [adapters](skill-adapters.md) explain differences from the source repository.
