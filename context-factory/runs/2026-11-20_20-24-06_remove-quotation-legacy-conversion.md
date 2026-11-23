# Remove quotation legacy conversion

Started: 2026-11-20T20:24:06+08:00
Updated: 2026-11-20T20:26:36+08:00
Status: complete
Scope: User-directed removal of legacy conversion from this task's unpublished quotation cleanup migration and tests; preserve unrelated work and application data
Checkout: main at fb4d86ab1c52e3252a94d8de22319235f970a74b; previous cleanup diff retained
Continues: [Quotation acceptance cleanup](2026-11-20_20-20-37_quotation-acceptance-cleanup.md)

## Goal

Remove the migration-only accepted-to-sent/superseded conversion. Current runtime code already has no acceptance compatibility path.

## Result

The unpublished migration directly drops acceptance schema pieces and enforces `draft`, `sent`, and `superseded`, without updating quotation rows. The regression uses supported states and checks preservation of those rows and linked history. Current README and the decision reflect the user's clarification; the preceding run remains historical evidence.

## Verification

Quotation and migration tests passed 19/19; guidance checks and all nine guidance tests passed. Scoped ESLint, Prettier, and whitespace checks passed. Prisma reports the schema up to date and no schema difference. After verifying the original migration checksum, existing constraints/indexes, and identical application-data fingerprints, reconciled only this task's unpublished migration checksum in the local Prisma ledger. No reset, legacy conversion, application-data rewrite, or committed-migration change occurred.

## Remaining work

No work remains. Frontend and runtime code did not change; no service restart or hosted rollout was needed.

## Resume here

Review the revised migration and regression. The preceding run describes the earlier conversion, which this follow-up removes.
