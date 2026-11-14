# Continue previous work

When continuing a topic, select its newest relevant run for the checkout/branch, follow any predecessor links, and confirm its claims against current Git state and affected files. A newer unrelated run does not supersede unfinished work. Historical summaries do not grant authorization.

## Write a handoff

Use [TEMPLATE](TEMPLATE.md) for a meaningful session or checkpoint on multi-session work, not every message or tool call. Name it `YYYY-MM-DD_HH-mm-ss_run-title.md` using **Asia/Manila** time and a lowercase kebab-case title. Add a short unique suffix if two writers would collide. Update your own in-progress record at a checkpoint/end; create a successor for a later run and link its predecessor.

Aim for 200–400 words. Record the goal and authorization, artifact state, result, changes/findings, evidence, outstanding work, and a concrete resume action. Link detailed decisions/checks rather than repeating them. Store lasting current rules at their canonical owner. Exclude transcripts, raw tool logs, private data, and credentials.

## Recent runs

Keep a compact index of recent/unfinished runs with topic, branch, status, and next action. Retain unresolved predecessors until a successor explicitly carries their work; find older completed runs by topic/date rather than loading the directory. Separate filenames protect parallel work; serialize shared index updates.

| Run | Topic / branch | Status | Next action |
| --- | --- | --- | --- |
| [Checklist removal](2026-11-14_23-46-07_checklist-removal.md) | Complete checklist removal after venue/staff cleanup / main | complete | Review combined local diff and additive migrations before publication |
| [Venue catalog and staff removal](2026-11-14_23-28-10_catalog-staff-removal.md) | PR #26 merge and complete local removal / main | complete | Review local cleanup and coordinate its additive migration before deployment |
| [Styled by AMAC rebrand](2026-11-14_14-02-28_styled-by-amac-rebrand.md) | Visible website identity / main | complete | Review or commit the scoped rebrand when requested |
| [Messages infinite scroll](2026-11-14_12-56-00_messages-infinite-scroll.md) | Customer/admin Messages / main | complete | Review or commit together with the preceding Messages context controls when requested |
| [Messages context controls](2026-11-14_12-42-00_messages-context-controls.md) | Customer/admin Messages / main | complete | Review or commit the scoped uncommitted changes when requested |
| [Customer events timeline](2026-11-14_11-50-00_customer-events-timeline.md) | Customer My events / main | complete | Review or commit the scoped uncommitted changes when requested |
| [Catalog filter disclosure](2026-11-14_11-33-00_catalog-filter-disclosure.md) | Customer catalog refinement / main | complete | Review or commit together with the preceding catalog changes when requested |
| [Customer catalog browsing](2026-11-14_11-29-00_customer-catalog-browsing.md) | Customer catalogs / main | complete | Review or commit the scoped uncommitted changes when requested |
| [Guidance reorganization](2026-11-14_10-59-01_context-factory-reorganization.md) | Context factory / main | complete | Select the next task through the router |
