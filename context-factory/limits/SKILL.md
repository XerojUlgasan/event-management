---
name: event-management-limits
description: Guidance for shared Clemora validation limits and API request-body caps.
---

# Shared limits

Use this section when changing a shared validation limit, its API enforcement, or a client-side hint. Read [Shared limits reference](reference/shared-limits.md) before editing. The canonical domain constants are exported by `@event-management/contracts`; API route schemas enforce domain constraints, and the API alone applies HTTP request-body caps. Keep those boundaries distinct.

Update the owning constant, each API or client consumer, boundary tests, and affected repository guidance together. Follow the reference for ownership and verification details.
