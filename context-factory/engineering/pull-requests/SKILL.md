---
name: pull-requests
description: "Prepare reviewable Clemora PRs or stacks with the actual base, coherent contracts, and evidence."
---

# Pull requests

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use when a PR, split, stack, or landing operation is requested or already authorized. Do not create branches, commits, PRs, or merges merely because an implementation used this guide.

1. Resolve repository, active checkout, dirty changes, and requested/default base. Verify the remote's actual base; this checkout uses main, not the source toolkit's develop. New agent branches use codex/ unless the user specifies otherwise.
2. Compare the complete change against that base, including local work relevant to the intended PR. Inspect untracked files. Separate handwritten and generated changes when estimating review size; generated Kysely types, lockfiles, and generated migrations still need review.
3. Aim for one coherent unit read in one sitting, usually under 400 handwritten changed lines. At 400–800, split independently verifiable behavior; keep an inseparable unit together. Over 800, seek safe preparatory cuts or explain why an atomic exception is needed before opening. This is a reviewability rule, not permission to split contracts into broken states.
4. Independent changes branch from the base separately. Dependent units may form a base-chained stack ordered bottom-up. Keep each independently deployable and verifiable. A schema/API/browser change may need one atomic PR or a bounded coordinated rollout; one PR does not make separate deployments atomic.
5. Include tests, generated files, and docs with the behavior they support. Show a failing reproduction and passing fix within the same delivered unit. Never land a deliberately failing test alone.
6. Run the relevant workspace/area checks and inspect user-facing behavior at the claimed boundary. Use [interrogate](../interrogate/SKILL.md) on the final artifact and [blast radius](../blast-radius/SKILL.md) for shared changes. Do not substitute nonexistent check:all, gen:data, e2e, kitchen, or stack commands.
7. Write a concise title and body using [technical writing](../technical-writing/SKILL.md). Lead with the concrete problem and resulting behavior. Include meaningful changes, dependencies/stack position when relevant, validation outcomes, and material risks or rollout needs. Link evidence and issues only when they exist. Use a repository template if present.

For a requested stack, use supported tools or explicit Git/PR base management; installation of a stack extension is not required. Serialize rebases and shared mutations. Preparing/opening PRs does not authorize merging.

For authorized landing, verify the exact PR URL, current head revision, base, checks, and merge scope immediately before mutation. Land parents before children, then recheck each child's base and diff after synchronization. Do not use an ambiguous stack-number command or merge additional members because they share a stack. Record what actually landed and its remaining proof limits.
