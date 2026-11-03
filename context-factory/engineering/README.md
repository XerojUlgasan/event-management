# Clemora engineering skills

These methods support the [senior developer](../agents/senior-developer/AGENT.md). They do not replace API, frontend, packages, limits, QA, or documentation ownership. Start every engineering task with the [operating contract](../shared/agent-workflow.md), [principle digest](../shared/engineering-principles.md), this index, and role memory. Read full skills selected below and every applicable area skill/reference before doing that work. Re-evaluate when scope changes and audit the selected requirements before delivery.

## Select a task workflow

| Full skill | Trigger and result |
| --- | --- |
| [architect](architect/SKILL.md) | Consequential unsettled design: grounded caller usage, distinct candidate comparison, chosen shape, and rationale before implementation. |
| [benchmark-checklist](benchmark-checklist/SKILL.md) | Measured performance claim: correct completed work, comparable tuning, limiter, repeated runs, and an evidence-qualified verdict. |
| [blast-radius](blast-radius/SKILL.md) | Shared contracts, schema/state, permissions, or indirect effects: downstream trace plus proof of the decisive safety fact. |
| [correct](correct/SKILL.md) | Requested recurring-mistake prevention: supported mistake classes and the strongest practical structural correction. |
| [figure-it-out](figure-it-out/SKILL.md) | Large task with no narrower playbook: acceptance evidence, verifiable phases, hypothesis loop, and a compact decision trail. |
| [how](how/SKILL.md) | Runtime behavior, code placement, or walkthrough: a source-grounded explanation of the actual flow and owners. |
| [interrogate](interrogate/SKILL.md) | Diff, PR, branch, patch, or design review: read-only target resolution, confirmed findings, and verification limits. Uses the existing code-review reference. |
| [pull-requests](pull-requests/SKILL.md) | Authorized PR preparation, splitting, stacking, or landing: actual base, reviewable deployable units, concise description, and verified scope. |
| [recall](recall/SKILL.md) | Requested context recovery: topic/time-bounded history checked against current Git/artifacts and a concrete next action. |
| [reflect](reflect/SKILL.md) | Requested retrospective: distinct judgment/tooling/alternative lenses and evidence-backed lessons routed to their owner. |
| [sharpen](sharpen/SKILL.md) | Requested task/prompt refinement: deeper raw evidence and methods with the same scope and open user choices. |
| [tdd](tdd/SKILL.md) | Explicit TDD/regression request or an obvious practical bug test: failing-before and passing-after behavior. Skip impractical new tests. |
| [teach](teach/SKILL.md) | Deeper plain-language understanding: integrate how and qualified why at the reader's requested depth. |
| [technical-writing](technical-writing/SKILL.md) | Engineering docs, skills, PR bodies, or commit messages: purpose-led structure, concrete instructions, and verified technical claims. |
| [typescript-best-practices](typescript-best-practices/SKILL.md) | Reading, editing, or reviewing TypeScript: owning schemas/types, real narrowing, valid states, and relevant checks. |
| [unslop](unslop/SKILL.md) | Prose polishing: remove filler and vague claims while preserving meaning, citations, and evidence limits. |
| [why](why/SKILL.md) | Rationale, threshold origin, or history: cited decisions, explicit inferences, competing explanations, and source-coverage gaps. |

The other 24 skills are individually registered in the [principle digest](../shared/engineering-principles.md). All 41 source skill names have local `SKILL.md` counterparts. Selected supporting methods are integrated into these self-contained workflows or linked to existing Clemora role/area references. Source prompt files and utilities are not copied; no source-specific review collector, kitchen system, or model panel is installed by this adaptation.

## Shared conventions

All eight source shared guides have local counterparts. Read the conventions relevant to the affected flow along with the standing operating contract and principle digest.

| Guide | Local responsibility |
| --- | --- |
| [agent-workflow](../shared/agent-workflow.md) | Standing authority, lifecycle, evidence, and handoff |
| [engineering-principles](../shared/engineering-principles.md) | Every-task principle selection and full-rule links |
| [skill-adapters](../shared/skill-adapters.md) | Local commands/capabilities, differences, and routing scenarios |
| [naming](../shared/naming.md) | Existing filenames, identifiers, SQL names, and camelCase wire contracts |
| [api-type-sync](../shared/api-type-sync.md) | Schemas, shared contracts, handwritten browser clients, and generated DB types |
| [frontend-design](../shared/frontend-design.md) | Current Clemora theme/UI owners and rendered verification |
| [frontend-project-structure](../shared/frontend-project-structure.md) | Astro host, React in-page views, and existing file placement |
| [shared-packages](../shared/shared-packages.md) | Contracts/UI/theme boundaries and evidence for new shared code |

## Maintain and verify

Edit canonical guidance here rather than copying it into personal assistant directories or caches. Keep role instructions in `agents/`, shared conventions in `shared/`, generic engineering methods in `engineering/`, and codebase detail with the existing area owner. Link a new workflow from this index or the principle digest. Review scenarios in the adapters after changing routing.

Run `pnpm check:guidance` after adding, moving, or editing guidance. It checks local links/anchors, skill metadata, registration, and reachability from the senior-developer entry point. It does not prove instruction compliance, technical claims, application behavior, or upstream parity. For an intentional source update, compare the local skill/shared inventories with the new source and inspect semantic differences before changing the recorded coverage.

## Provenance and adaptation

Inspected on 2026-11-03: Upskwela `tools/context-factory/engineering/` and `tools/context-factory/shared/` at commit `b034f5dec931641a65b85419e8c0810d6ab85ce0`, with no working-tree changes in those directories. All 41 skill entry points and 8 shared guides were read. The local adaptations preserve their methods while replacing source-specific paths, tools, test setup, naming, brand, and product assumptions with current Clemora evidence. They are maintained independently; no cross-checkout dependency remains.

The source toolkit attributes its methods and supporting prompts to the MIT-licensed pstack plugin by Lauren Tan, snapshot `519d36aa98955bf680db01bcde5fdfba686dc901`. The [license notice](LICENSE) is retained. No external package or plugin was installed.
