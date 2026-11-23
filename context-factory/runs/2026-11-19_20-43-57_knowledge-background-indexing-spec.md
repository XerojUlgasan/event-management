# Knowledge background indexing specification

Started: 2026-11-19T20:41:13+08:00
Updated: 2026-11-19T20:44:55+08:00
Status: complete
Scope: Investigate manual Knowledge Catalog indexing and existing owner jobs; create a specification only. No application changes, workers, database mutations, or provider calls.
Checkout: main at 4131b0d; substantial pre-existing uncommitted message, queue, UI, and documentation work preserved.
Continues: [Catalog background jobs](2026-11-19_15-53-34_catalog-background-jobs.md)

## Goal

Specify how Index pending discovers all eligible pending package/service owners and submits them individually through the existing background queue.

## Result

Created the [proposed specification](../../docs/specs/knowledge-catalog-background-indexing.md) and linked it from the root README without changing current implementation claims. Application implementation remains a separate task.

## Changes or findings

- Current manual indexing is a page-dependent cursor loop processing one chunk per request; automatic saves already enqueue durable owner jobs covering text and photos.
- Proposed discovery reuses current freshness assessment, including missing rows and withdrawn chunks, independently of table filters. Sequential short enqueue transactions submit one package/service owner at a time.
- Submission counts describe accepted work, including pending-job coalescing. They do not describe completed embeddings or newly inserted rows. Partial failures and interrupted submission remain retryable; committed jobs survive navigation.
- Existing execution concurrency remains three jobs per worker process. Pending re-enqueue resets retry timing; a running owner can have one pending successor.

## Decisions

The spec proposes provider-free HTTP discovery/submission and retains current worker policy. A durable dispatcher is a fallback if representative catalog volume cannot fit the request budget. These are design proposals, not implemented or runtime-proven changes.

## Verification

Lead source inspection and separate Luna queue investigation completed. Independent Terra review found an overstated photo-digest discovery guarantee; the spec now explicitly preserves the existing immutable-photo identity limitation, and re-review found no further issues. Documentation links/routes passed `pnpm check:guidance`; all nine `pnpm test:guidance` cases, scoped formatting, and diff whitespace checks passed. The applicable investigation, AI, API, frontend/packages, documentation, and continuation routes were walked. No application tests or runtime checks were run for this documentation-only task.

## Remaining work

The specification task is complete. Future implementation requires the acceptance cases in the spec, including large-catalog timing, partial submission, worker lifecycle, Node/Edge contracts, and browser behavior. Live pending counts, provider results, and deployment remain unverified.

## Resume here

Read the spec before implementation and refresh the dirty checkout. This task authorizes the specification only; do not start workers or infer deployment/provider success from source inspection.
