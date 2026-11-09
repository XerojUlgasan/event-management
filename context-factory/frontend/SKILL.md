---
name: event-management-frontend
description: Repository guidance for the Clemora Astro host, React screens, app state, client authentication, API calls, app styles, and mandatory package reuse for every UI change.
---

# Frontend

Use this skill for `apps/web/` changes. Read every reference below before editing. Verify current behavior in the touched files and update these notes if they drift.

Astro supplies the HTML host and frontend development/build tooling; React owns application screens and state. Investigate `apps/web/package.json`, the framework configuration, and the entry point before changing setup or architecture claims.

Screens communicate with the API by importing functions from `apps/web/src/lib/data/`. Those functions call `request` in `src/lib/http.ts`. Read [client layers](reference/client-layers.md) before adding a request, a client-only sequence, or a pure helper. Leave route handlers, business services, and SQL in `apps/api`.

## Important: package reuse is mandatory for every UI change

Load the [packages skill](../packages/SKILL.md) and all its required references before any UI edit, even when the expected change stays entirely in `apps/web`. Follow the [required package reuse workflow](../shared/shared-packages.md#required-workflow-for-every-ui-change): inspect current exports and relevant implementations, reuse or extend the owning package, then audit the result. Page-only components, CSS-only fixes, mock screens, and redesigns all follow this rule.

Use `@event-management/ui` for existing presentation components, theme tokens for shared design values, and `@event-management/contracts` for existing shared types and limits. Keep app-specific composition and behavior in `apps/web`; document a concrete mismatch before introducing a local alternative to a shared primitive. The workflow defines placement, export, story, styling, and verification requirements.

## Required references

- [Client layers](reference/client-layers.md)
- [Pages and application structure](reference/pages-and-structure.md)
- [Client data and authentication](reference/data-and-auth.md)
- [Styling and verification](reference/styling-and-verification.md)
- [Mandatory package reuse workflow](../shared/shared-packages.md)
- [Shared Clemora UI usage](clemora-ui/SKILL.md)

For API route or database work, also load the [API skill](../api/SKILL.md).

When a browser form mirrors API field, image, or collection limits, read the [shared limits guidance](../limits/SKILL.md) and keep client hints aligned with the API contract.
