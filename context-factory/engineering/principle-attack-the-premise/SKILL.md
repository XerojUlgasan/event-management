---
name: principle-attack-the-premise
description: "Recheck a shared assumption after two fixes fail the same gate."
---

# Attack the premise

Follow the [Clemora workflow adapters](../../shared/skill-adapters.md) and [operating contract](../../shared/agent-workflow.md).

After two fixes based on the same premise fail the same check, write down that premise and test it before trying a third fix. Choose an observation that would differ if the premise were false. Compare where failures occur as well as their size.

For Clemora, verify the actual server process, checkout, API base, and response contract before assuming a browser failure comes from the source you just edited. If the premise fails, follow the new evidence. If it holds, continue tracing the first wrong decision with [root-cause analysis](../principle-fix-root-causes/SKILL.md). Remove the cause rather than adding compensating retries or cleanup. Make the decisive check rerunnable when useful.
