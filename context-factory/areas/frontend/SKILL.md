---
name: event-management-frontend
description: Change or investigate the Clemora Astro and React frontend, client data, authentication, styling, or UI.
---

# Frontend

Read [project structure](references/project-structure.md) for `apps/web` placement and dependency boundaries. Inspect the touched screen and its callers before editing.

**Every UI change**, including page-only, CSS-only, mock, and shared-package changes, requires the [packages entry](../packages/SKILL.md) and [reuse workflow](../packages/references/reuse.md). Inspect relevant exports, implementations, stories, styles, tokens, contracts, and consumers before choosing an owner; complete its audit before delivery.

Load references for the affected work:

- Browser API calls, sequences, and helpers: [client layers](references/client-layers.md); for response or payload changes also read [API and type synchronization](../contracts/references/api-type-sync.md).
- Login, session restoration, or role-based UI: [client data and auth](references/data-and-auth.md) and [API auth](../api/references/auth-and-sessions.md).
- Public pages or workspace navigation: [pages and application structure](references/pages-and-structure.md).
- Visual design, styling, or catalog canvas: [design](references/design.md) and [styling and verification](references/styling-and-verification.md).
- Selecting or extending shared controls: [Clemora UI usage](references/clemora-ui.md).
- Mirrored form or upload constraints: [contracts](../contracts/SKILL.md).
- Business behavior: [business domain router](../../business/README.md); confirm implemented behavior in source.
