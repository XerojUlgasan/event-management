# Clemora context factory

Start with [repository guidance](../AGENTS.md) and the selected [role](agents/README.md). These files are the canonical project guidance; read them directly when a client does not discover skills automatically.

| Guidance | Responsibility |
| --- | --- |
| [Shared operating contract](shared/agent-workflow.md) | Authority, task lifecycle, evidence, and handoff on every engineering task |
| [Engineering principles](shared/engineering-principles.md) | Standing rules, applicability, and links to the full principle skills |
| [Engineering skills](engineering/README.md) | Investigation, design, implementation, review, teaching, writing, and delivery methods |
| [Workflow adapters](shared/skill-adapters.md) | Clemora commands, capabilities, source-toolkit differences, and verification scenarios |
| [API](api/SKILL.md), [frontend](frontend/SKILL.md), [packages](packages/SKILL.md), [limits](limits/SKILL.md), [QA](QA/SKILL.md) | Implementation ownership and required area references |
| [Agents](agents/README.md) | Senior developer and documentation roles, task references, and memory policy |

The senior developer reads the operating contract, principle digest, and engineering index at the start of every task, then loads the full skills selected by their triggers. Shared conventions link to area owners rather than replacing them. The documentation agent owns document structure and evidence; technical writing complements that role.

After changing guidance, run `pnpm check:guidance`. This checks navigation, skill metadata, and registration. It cannot prove that an agent followed instructions or that application behavior works; inspect technical claims against source and exercise the affected behavior separately.
