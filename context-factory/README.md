# Find the right guidance

Follow the standing rules in [AGENTS.md](../AGENTS.md). Select all rows that match the work; read only the references whose stated conditions apply. A link makes guidance discoverable, not automatically mandatory. Recheck selection when scope changes.

## Choose the responsibility

| Work | Role |
| --- | --- |
| Engineering investigation, planning, implementation, review, tickets, or verification | [Senior developer](agents/senior-developer.md) |
| Repository docs, manuscripts, research, prose, or defense preparation | [Documentation](agents/documentation.md) |

## Choose the affected area

| Work | Required area |
| --- | --- |
| Background jobs, queue, workers, retries, or job types | [Background jobs](areas/background-jobs/SKILL.md) and [API](areas/api/SKILL.md) |
| HTTP routes, auth/sessions, API services, SQL, schema, migrations | [API](areas/api/SKILL.md); authentication/permission work also reads [auth/sessions](areas/api/references/auth-and-sessions.md) |
| AI agents, tools, prompts, model decisions, knowledge retrieval, or AI Gateway | [AI](areas/ai/SKILL.md); API integration also reads [API](areas/api/SKILL.md); product actions also read the matching [business rules](business/README.md) |
| Astro pages, React views, client requests/auth, app CSS | [Frontend](areas/frontend/SKILL.md) |
| Any UI change; shared components, Storybook, tokens | [Packages](areas/packages/SKILL.md); UI changes also require [frontend](areas/frontend/SKILL.md) and [package reuse](areas/packages/references/reuse.md) |
| Shared DTOs, field/file/collection limits, API body caps | [Contracts](areas/contracts/SKILL.md), [API/type sync](areas/contracts/references/api-type-sync.md), and [limits](areas/contracts/references/shared-limits.md) as applicable |
| Responsibilities, permissions, catalog, inquiries, quotations, messages, or event scheduling | [Business domain router](business/README.md), then its matching domain references |

## Choose the task

| Task | Workflow |
| --- | --- |
| Explore, explain, plan a design, debug before editing, recover context, review lessons, sharpen a prompt | [Investigate](workflows/investigate/SKILL.md) |
| Implement, refactor, fix a bug, change contracts, use TDD | [Implement](workflows/implement/SKILL.md) |
| Review a diff, branch, PR, or proposed design | [Review](workflows/review/SKILL.md) |
| Test accounts, authenticate API checks, inspect SQL, seed one table, benchmark | [QA](workflows/qa/SKILL.md) |
| Write/revise repository guidance or documents; polish a paper or produce a document artifact | [Documentation](workflows/documentation/SKILL.md) |
| Capstone ideation/validation, literature, research methods, citations, defense preparation | [Research](workflows/research/SKILL.md) |
| Write an implementation, bug, spike, or Epic ticket | [Tickets](workflows/tickets/SKILL.md) |
| Prepare, split, stack, open, or land authorized PR work | [Pull requests](workflows/pull-requests/SKILL.md) |

## Continue or retain evidence

- [Runs](runs/README.md): newest relevant work summary, unfinished items, and next action. Read when continuing a topic; write a compact handoff for meaningful multi-session work.
- [Decisions](history/decisions/README.md): lasting choices, authority, rationale, and consequences. Current rules remain with their area/domain owner.
- [Verification](history/verification/README.md): dated checks, tested artifact/environment, outcomes, and proof limits.
- [History index](history/README.md): locate earlier evidence and rationale.
- [Attribution](history/attribution.md): imported toolkit provenance and license; maintenance reference only.

For guidance changes, use the [routing scenarios](routing-checks.md). Executable helpers live in `tools/`; select them through their owning workflow. Historical records are evidence, never startup instructions or new authorization.
