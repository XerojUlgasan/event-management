# Context factory reorganization

Started: 2026-11-14T10:59:01+08:00
Updated: 2026-11-14T11:05:48+08:00
Status: complete
Scope: Implement approved guidance structure, conditional routing, and handoff records; preserve application behavior.
Checkout: main, baseline 95403f0, initially clean; guidance changes uncommitted.
Continues: none (prior investigation occurred in this chat)

## Goal

Simplify contributor guidance and verify routes to the appropriate role, area, task, reference, and continuation record.

## Result

Completed the approved reorganization with 12 skill entries instead of 49. Standing rules live in root AGENTS.md; the task router selects area/business/workflow references conditionally. Current guide text is about 25,000 whitespace words, with dated evidence retained separately.

## Changes or findings

- Organized roles, areas, business, workflows, tools, history, and runs; updated incoming links and package commands.
- Consolidated principles and repeated implementation digests. Every UI edit still requires frontend, packages, structure, and reuse/audit.
- Added decision/verification/run templates and indexes. Runs use Asia/Manila datetime filenames and preserve unfinished work and authorization.
- Terra helpers owned areas/business, writing/research, and checker work. Independent Sol review found one missing TypeScript investigation route; fixed and cleared on follow-up.

## Decisions

[Accepted organization](../history/decisions/2026-11-14_guidance-organization.md). Current product rules and application behavior are unchanged.

## Verification

[Verification record](../history/verification/2026-11-14_11-05-48_guidance-reorganization.md): guidance check, 9/9 checker tests, helper syntax/help, targeted formatting, preservation checks, and diff checks passed. No API/database/browser/provider behavior was exercised.

## Remaining work

None for the approved reorganization. Work is uncommitted; no PR, merge, deployment, migration, seed, or service restart was performed.

## Resume here

For the next task, inspect current Git state and [task router](../README.md), then choose only applicable guides. Re-read this run only when continuing guidance work. Commit or publish only if requested; never treat these historical checks as proof of later code or hosted behavior.
