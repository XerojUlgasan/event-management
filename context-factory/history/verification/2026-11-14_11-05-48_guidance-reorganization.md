# Guidance reorganization verification

Checked at: 2026-11-14T11:05:48+08:00
Outcome: passed
Artifact: main at baseline 95403f0 plus the uncommitted guidance reorganization; no application source changes.
Environment: local filesystem, Node/pnpm; no API login, database connection, browser, or provider checks.

## Claim checked

The approved structure has one task router, conditional role/area/workflow/reference routes, retained mandatory UI reuse and source/evidence rules, usable relocated QA entry points, and decision/verification/run templates with a continuation index.

## Results

| Check or journey | Expected | Observed | Result |
| --- | --- | --- | --- |
| `pnpm check:guidance` | Valid local links/anchors, unique skill metadata, current-guide reachability, required root/downstream routes, run format/index chains; no obsolete live paths | Passed on the integrated tree; 12 skills | Pass |
| `pnpm test:guidance` | Valid fixtures accepted; representative broken navigation, metadata, routes, or runs rejected | 9 tests passed, none skipped | Pass |
| `git diff --check` | No whitespace errors in tracked changes | Passed | Pass |
| QA helpers: `node --check` for config/session/pg-query, then both `--help` commands | Relocated imports resolve and usage names current paths without API/DB work | All passed | Pass |
| Targeted Prettier check | README/package JSON and new checker/test code match formatter | Passed | Pass |
| Source/preservation comparison | No app/contracts/theme/UI source changes; same QA helper behavior and retained license/history | License and QA config identical; helper script differences are usage paths only; archived QA report unchanged; ledger and legacy notes retain historical observations with rebased links/framing | Pass |
| Semantic route walk and independent Sol review | Relevant guides reached for CSS/UI reuse, auth, contract limits, read-only TypeScript investigation, business responsibilities, seed, docs/paper, PR, and continuation | One missing TypeScript investigation link found and fixed; follow-up reported no actionable findings and independently reran guidance/tests/diff checks | Pass |

## Evidence

- [Task router](../../README.md), [routing scenarios](../../routing-checks.md), [standing rules](../../../AGENTS.md).
- [Checker](../../tools/check-guidance.mjs) and [negative/valid fixtures](../../tools/check-guidance.test.mjs).
- [Accepted decision](../decisions/2026-11-14_guidance-organization.md) and [run](../../runs/2026-11-14_10-59-01_context-factory-reorganization.md).
- Source comparisons used Git baseline 95403f0; the temporary local snapshot was only a migration aid and is not required to continue.

## Limits and gaps

These checks establish guidance structure, examined content, and helper entry-point import/syntax behavior. They do not guarantee future agent compliance, prove every Markdown/YAML syntax variant, or establish API, SQL, browser, live authentication, or hosted-provider behavior. Application suites/builds were not run because application source and behavior did not change. Historical test results retain their original dates and boundaries.

## Follow-up

No implementation work remains for this reorganization. Recheck affected routes when adding/moving guidance. No services, shared records, fixtures, or databases were changed; no cleanup is required. Changes remain uncommitted.
