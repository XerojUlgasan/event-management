---
name: technical-writing
description: "Write or review Clemora engineering prose with clear structure, concrete instructions, and source evidence."
---

# Technical writing

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use for repository guides, skills, RFCs, PR descriptions, and commit messages. Load the [documentation agent](../../agents/documentation/AGENT.md) for durable document work and its recursive review; this skill complements that ownership. Product UI copy follows the affected product flow and design guidance.

Choose the document's purpose before drafting:

- Tutorial: help someone complete a learning exercise with visible results.
- How-to: steps toward a practical goal, with conditions before actions.
- Reference: facts organized for lookup, including options, limits, and errors.
- Explanation: a bounded account of mechanism, context, rationale, and tradeoffs.

Keep sections coherent and link supporting detail rather than forcing every mode into one procedure. Use current code names, commands, and paths. Verify implementation claims through source/configuration and behavior evidence when required. A link check only proves navigation. Preserve historical sources, citations, approved scope, and uncertainty.

Write active sentences naming the actor. Use present tense for current behavior, direct commands for steps, everyday words, one term per concept, and enough articles/verbs to remove ambiguity. Put conditions and destructive consequences before the guarded action. Split dense instructions. Keep words such as only and not next to what they qualify. Prefer descriptive links, sentence-case headings, numbered sequences, and genuinely parallel bullets.

Remove filler and abstractions through [unslop](../unslop/SKILL.md). Preserve a useful long sentence when it carries one coherent idea; rigid word counts and stylistic rules must not damage accuracy. Do not confuse intended and implemented work.

For Clemora, the README owns scope, implementation status, and setup; context-factory owns contributor methods. Use .env.example for variable names and never copy secret values. A PR body leads with problem and resulting behavior and includes only validation and risks useful to its reviewer. Verify the saved artifact, local references, and affected technical claims before delivery.
