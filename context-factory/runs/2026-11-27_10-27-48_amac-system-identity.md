# AMAC system identity

Started: 2026-11-27T10:14:25+08:00
Updated: 2026-11-27T10:27:48+08:00
Status: complete
Scope: Remove the previous system branding and former client materials from the current codebase.
Checkout: main at 97fb5eec, local changes.
Continues: [Visible website identity](2026-11-14_14-02-28_styled-by-amac-rebrand.md).

## Result

AMAC names the system across the workspace, API, local Supabase project, and worker schedules. The supplied Styled by AMAC artwork remains the business identity. The former client interview records and retired UI prototype were removed from the working tree. The separate November 14 interview remains.

## Upgrade

Applied migrations retain their checksums. Forward migrations replace the runtime objects and update the exact addresses of known demo users when available. Stable fixture IDs preserve relationships across seed reruns. Compatibility reads recover existing browser drafts and notices. The guest-chat lock also coordinates with tabs opened before the upgrade. See [migration impact](../workflows/implement/references/development.md#migration-impact).

## Verification

The original local database and storage volumes were retained. The AMAC stack started from copies. The pending Realtime repair and both rebrand migrations applied to that database. Counts before and after were 122 users and 100 booking requests. All 106 known fixture addresses updated.

The browser showed the branded homepage, signed in with a migrated customer account and loaded the mobile catalog. Live private Realtime subscriptions received conversation and notification broadcasts and denied another user’s topics. A disposable database replayed all 100 migrations and verified worker schedule replacement and a repeat scheduler run. The build and changed-file lint passed. Workspace lint reported 20 existing spacing errors in 12 unchanged files.

## Resume here

Run `pnpm dev` in this checkout and open the [local website](http://localhost:4321). Hosted deployment is a separate operation.
