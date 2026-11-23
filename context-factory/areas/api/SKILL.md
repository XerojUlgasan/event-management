---
name: event-management-api
description: Change or investigate Clemora API routes, auth, database, migrations, media, or API tests.
---

# API

For `apps/api` work, read [structure and routes](references/structure-and-routes.md), inspect the touched route and its callers, and choose relevant [verification](references/verification.md).

- Authentication, sessions, identity, or permissions: [auth and sessions](references/auth-and-sessions.md).
- Schema, migrations, database access, or seed: [database and migrations](references/database-and-migrations.md).
- Background queue, worker, retry policy, or job type: [background jobs](../background-jobs/SKILL.md).
- Catalog uploads, Storage, image permissions, or media migrations: [catalog media](references/external-image-urls.md).
- Shared constraints or HTTP body caps: [contracts](../contracts/SKILL.md).
- Browser-facing contract or client auth: [API and type synchronization](../contracts/references/api-type-sync.md) and [frontend](../frontend/SKILL.md).
- Business behavior: [business domain router](../../business/README.md); distinguish intended policy from current code.
- AI agents, tool execution, prompts, model decisions, retrieval, or Gateway integration: [AI](../ai/SKILL.md), including its placement and execution standards.
