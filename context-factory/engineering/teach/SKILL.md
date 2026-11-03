---
name: teach
description: "Explain a Clemora feature or change plainly using verified behavior and qualified rationale."
---

# Teach

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

The goal is understanding, within the requested explanation-only scope. Decide what the person needs from the question and conversation rather than quizzing them.

Use [how](../how/SKILL.md) for mechanism and [why](../why/SKILL.md) when motivation or history matters. Reuse their source work instead of repeating it. A narrow implementation question may need only how; a subsystem explanation often needs both. Keep why's confidence and missing-evidence language intact.

Start with a plain definition and what it means here. Walk through a concrete action, such as saving a catalog entry or submitting an inquiry, and build the important concepts in that order. Explain the rule and consequence before listing filenames. Link only the files that help the person follow the flow.

Use a small diagram or an incremental visual when it makes multiple moving parts easier to understand. Simple facts do not need figures. Match depth to the question, avoid lectures and forced pacing, and leave deeper branches for follow-up.

Apply [unslop](../unslop/SKILL.md). Give the explanation itself, not a report about having researched it. Distinguish current implementation, planned behavior, and observed results. Never teach an accepted request as a reservation or describe demo screens as persisted features.
