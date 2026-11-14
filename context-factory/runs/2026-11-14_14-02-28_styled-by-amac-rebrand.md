# Styled by AMAC rebrand

Started: 2026-11-14T14:02:28+08:00
Updated: 2026-11-14T14:02:28+08:00
Status: complete
Scope: Implement the supplied-logo rebrand after read-only exploration and explicit design approval; preserve product behavior and existing records.
Checkout: main, ce0a5ef; clean at investigation start, scoped changes uncommitted at completion.
Continues: none

## Goal

The user selected **Styled by AMAC** as the visible name and approved the original logo, charcoal/off-white/taupe palette, spacious serif-led public pages, and matching login and workspaces.

## Result

Implemented the approved identity through shared theme/UI ownership and the existing Astro/React architecture. The independent visual reviewer returned **ship** after a focused favicon/header correction. No deployment or commit was requested.

## Changes or findings

- Preserved the original logo bytes in the UI package; Brand/Wordmark frame blank padding without altering the artwork. The SVG favicon frames its first A from the same embedded source.
- Harmonized existing theme aliases, public typography/composition, native mobile navigation, authentication presentation, and workspace surfaces. Operational status colors and internal identifiers remain unchanged.
- Updated visible copy, current design guidance, and [design](../../apps/web/DESIGN.md)/[product](../../apps/web/PRODUCT.md) records. Existing catalog records and imagery were preserved; historical client research remains intact.

## Decisions

[README](../../README.md) owns product scope. [Frontend design guidance](../areas/frontend/references/design.md) owns the implementation baseline; this rebrand establishes a visible identity, not changed business rules.

## Verification

Passed `pnpm check`, web build, Storybook build, catalog tests (8/8), design ownership (137 sources), guidance checks/tests (9/9), scoped formatting, and diff whitespace checks. Web check/build and design ownership passed again after final fixes; build retains its chunk-size advisory. Original/shared/favicon embedded PNG bytes match.

Local desktop/mobile captures cover public pages, login, customer, admin, staff, and admin catalog preview. Mobile navigation and authentication mode switching were exercised. Existing development fixtures were used; task sessions were logged out and the original customer browser session restored. No application records were changed. Editor interaction stalled in browser tooling, so full editor behavior was not verified. Screenshots and local checks do not establish production deployment or every browser’s favicon appearance.

## Sidebar follow-up

The user requested matching the admin sidebar to the navbar/shell. Its app-owned CSS now uses the header paper surface, dark text, soft selection/hover states, and visible account/close controls. Desktop and mobile drawer captures were inspected; open/close worked. Web structure, design ownership, Astro check/build, formatting, and whitespace checks passed again. The temporary admin session was logged out and the original customer session restored.

## Calendar follow-up

The user identified pink count cells in the booking calendar. Shared MonthCalendar intensity level 3 incorrectly used a danger-border token; it now uses brand taupe with deep charcoal text (date contrast 5.65:1, count badge 4.73:1). The shared legend follows automatically. The populated November admin calendar was visually verified. UI typecheck, Storybook/web builds, design ownership, formatting, and whitespace checks passed. Calendar counts and selection logic are unchanged.

## Remaining work

None within the approved rebrand. Existing synthetic catalog content is not production content.

## Resume here

Review the uncommitted diff and shared theme/Brand sources before any further visual change. Commit or deploy only when requested.
