---
name: event-management-packages
description: Repository guidance for mandatory package reuse in every Clemora UI change, shared React components, Storybook stories, exports, styles, and theme tokens.
---

# Packages

Use this skill for `packages/ui/` or `packages/theme/` changes and for **every UI change**, including changes confined to `apps/web`. Read every reference below before editing. Follow the touched component's current conventions and update stale guidance.

Follow the [mandatory package reuse workflow](../shared/shared-packages.md#required-workflow-for-every-ui-change) and its completion audit. Inspect existing exports before adding a local primitive or shared component; keep reusable presentation, styles, and tokens with their established owners.

## Required references

- [Ownership and exports](reference/ownership-and-exports.md)
- [Components and Storybook](reference/components-and-storybook.md)
- [Theme, styles, and verification](reference/theme-and-verification.md)
- [Shared Clemora UI usage](../frontend/clemora-ui/SKILL.md)

For app-specific use or changes to `apps/web`, also load the [frontend skill](../frontend/SKILL.md).

For shadcn setup, registry components, presets, or shadcn-based design-system work, read the [Clemora integration notes](reference/shadcn.md), then the installed [shadcn skill](../../.agents/skills/shadcn/SKILL.md). Apply its component APIs to verified shadcn components; keep existing Clemora components under their current contracts until an authorized migration changes them.

Shared domain limit constants live in `@event-management/contracts`; read the [shared limits guidance](../limits/SKILL.md) when changing those values or their consumers.
