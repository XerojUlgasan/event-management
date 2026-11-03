# Senior developer memory

Durable engineering notes for this role. Read and maintain them under the shared [memory policy](../README.md#memory).

## 2026-11-03 — Engineering and shared toolkit ownership

The [engineering index](../../engineering/README.md) and [Clemora adapters](../../shared/skill-adapters.md) own the local adaptation of the inspected Upskwela engineering/shared toolkit. Root guidance and this role's entry point require the operating contract, principle digest, and engineering index on every task, full applicable skills, and a completion audit. Implementation detail remains with the existing area skills.

**Evidence:** All 41 source skill paths and 8 shared guide paths matched local counterparts; all skill metadata passed the skill-creator validator. `pnpm check:guidance` passed, and isolated fixtures proved that valid navigation passes while missing targets/anchors, unregistered entries, invalid metadata, and missing standing-guide links fail. Manual routing checks covered limits, explanation-only work, review, TypeScript fixes, shared UI, and PR preparation against current source. This establishes guidance coverage and routing, not future compliance or application runtime behavior.

**Why it matters:** Maintain these canonical files without restoring source-project paths, generated-browser-client assumptions, kitchen dependencies, branding, or business policy. Recheck local contracts and scripts when updating the toolkit.

## 2026-11-03 — Verify links after moving guidance

Moving task workflows into the agent's `reference/` folder changed the relative paths to repository and QA guidance. Include new and moved files when checking local links; a tracked diff alone can omit new files.

**Evidence:** The current [code review](reference/code-review.md) and [ticket-writing](reference/ticket-writing.md) guides link to the shared guidance from their new locations. Verified by local Markdown link checks; this establishes guidance integrity only.

**Why it matters:** Future reorganizations need to preserve access to area guidance and ticket templates.
