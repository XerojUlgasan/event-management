---
name: event-management-api
description: Repository guidance for changes to the Clemora Hono API, OpenAPI routes, authentication, sessions, PostgreSQL schema, Kysely access, and API tests in apps/api.
---

# API

Use this skill for `apps/api/` changes. Read every reference below before editing. Follow the current implementation when it differs from these notes, and update stale guidance.

## Required references

- [Structure and routes](reference/structure-and-routes.md)
- [Authentication and sessions](reference/auth-and-sessions.md)
- [Database and migrations](reference/database-and-migrations.md)
- [Verification](reference/verification.md)
- [R2 catalog image storage](reference/r2-image-storage.md)

For a change involving the browser API contract or client auth flow, also load the [frontend skill](../frontend/SKILL.md). For product behavior, consult [`docs/FEATURES.md`](../../docs/FEATURES.md) and distinguish planned workflows from implemented endpoints.

For shared field, file, or collection limits and the API's HTTP body caps, read the [shared limits guidance](../limits/SKILL.md).
