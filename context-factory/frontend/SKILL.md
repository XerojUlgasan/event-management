---
name: event-management-frontend
description: Repository guidance for the Clemora Astro host, React screens, app state, client authentication, API calls, and app styles in apps/web.
---

# Frontend

Use this skill for `apps/web/` changes. Read every reference below before editing. Verify current behavior in the touched files and update these notes if they drift.

Astro supplies the HTML host and frontend development/build tooling; React owns application screens and state. Investigate `apps/web/package.json`, the framework configuration, and the entry point before changing setup or architecture claims.

## Required references

- [Pages and application structure](reference/pages-and-structure.md)
- [Client data and authentication](reference/data-and-auth.md)
- [Styling and verification](reference/styling-and-verification.md)

For API route or database work, also load the [API skill](../api/SKILL.md). For reusable UI or tokens, also load the [packages skill](../packages/SKILL.md).

When a browser form mirrors API field, image, or collection limits, read the [shared limits guidance](../limits/SKILL.md) and keep client hints aligned with the API contract.
