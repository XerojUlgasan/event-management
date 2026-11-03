# Senior developer memory

Durable engineering notes for this role. Read and maintain them under the shared [memory policy](../README.md#memory).

## 2026-11-03 — Verify links after moving guidance

Moving task workflows into the agent's `reference/` folder changed the relative paths to repository and QA guidance. Include new and moved files when checking local links; a tracked diff alone can omit new files.

**Evidence:** The current [code review](reference/code-review.md) and [ticket-writing](reference/ticket-writing.md) guides link to the shared guidance from their new locations. Verified by local Markdown link checks; this establishes guidance integrity only.

**Why it matters:** Future reorganizations need to preserve access to area guidance and ticket templates.
