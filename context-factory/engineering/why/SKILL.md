---
name: why
description: "Investigate the evidence behind a Clemora design decision without inventing author intent."
---

# Why

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

Use for design rationale, historical tradeoffs, regression history, defensive code, or the origin of a threshold. [How](../how/SKILL.md) explains current mechanism; current code alone cannot prove why an author chose it. Keep the investigation read-only.

## Anchor and search

State the target and question. Inspect relevant code and establish an anchor: files/symbols, git blame for changed lines, log history through renames, substantive commits, and linked PR/issues. Read the underlying discussion when available; a recent commit is not automatically the original rationale.

Discover authorized available sources. Track all seven evidence categories as searched, empty, unavailable, outside scope, or irrelevant with a reason: source control; issue tracker; long-form documents; team chat; infrastructure observability; error tracking; product analytics. Match search breadth to the actual question. Narrow teaching questions can use scoped Git/docs evidence with other categories explicitly left unsearched. Do not imply a complete historical answer from that narrow pass.

For each relevant reachable source, search identifiers, symptom wording, dates, and linked decisions. Record null results as findings. For defensive code, look for incidents, failed fixes, timeouts, or data conditions that could explain the guard rather than assuming it was prudent. Data investigation uses authorized read-only procedures and sanitized results; a connector's presence or stored credential does not authorize access.

Clemora's local record includes Git, the README's separated scope/implementation, retained interview evidence, docs/SEED.md, context-factory, and role memories. Memories are pointers to evidence, not independent confirmation. Use connected PR/issue or other read tools only when relevant and authorized. No pantry, analytics warehouse, chat service, or error tracker is assumed.

## Judge confidence

Keep claims in distinct tiers with citations:

- Direct: an explicit source states the reason.
- Supported: several indirect sources converge; explain the chain.
- Inferred: a reasonable interpretation labeled as such.
- Speculative: a plausible competing hypothesis with thin evidence.
- Unknown: sources searched did not establish a reason.

Do not confirm the user's hypothesis without checking it, retrofit a tidy rationale, treat silence as proof, or hide contradictory sources. Preserve these qualifications when teaching or polishing the answer.

Use separate investigation/synthesis passes for a broad question. Independent helpers require authorization and stay read-only; otherwise disclose sequential investigation. Present the answer at the requested depth with evidence, reasonable inferences, alternatives, unknowns, coverage, and confidence. If this precedes a change, convert supported history into constraints to preserve, changes allowed, approaches to avoid, and risks. Missing rationale does not by itself authorize deleting the code.
