# Documentation memory

Durable documentation notes for this role. Read and maintain them under the shared [memory policy](../README.md#memory).

## 2026-11-11 — Business responsibilities have a domain reference

The [business-logic skill](../../business-logic/SKILL.md) routes role and workflow work to the [identity reference](../../business-logic/references/identity.md). It records the user's intended responsibilities: admins own customer communication and event decisions; staff volunteer; admins select teams and coordinators; coordinators track timed checklists. The [README](../../../README.md#current-implementation) retains implementation status. This is business direction, not proof that all described workflows are implemented.

**Evidence:** User direction, source inspection of identity and staffing rules, and guidance/skill validation on 2026-11-11. Keep technical authorization detail with the API guidance and preserve the distinction between an account role and an event assignment.

## 2026-11-09 — Browser API calls are a frontend reference

The rule for how `apps/web` calls `/v1` lives in [client layers](../../frontend/reference/client-layers.md). The frontend skill lists it as a required reference. [Client data and authentication](../../frontend/reference/data-and-auth.md) keeps persisted-flow facts and points at that reference for placement. The shared [frontend structure](../../shared/frontend-project-structure.md) table stays a short index.

**Evidence:** `apps/web/src/lib/http.ts` is the only `fetch` under `apps/web/src`. Domain calls are in `src/lib/data/`. There is no `apps/web` controller folder. This records documentation ownership, not a new runtime check.

**Why it matters:** Put a change to that call path in the frontend reference and the skill's required list. Do not describe the website as a second controller/service/data stack.

## 2026-11-03 — Engineering prose and shared guidance

Use [technical writing](../../engineering/technical-writing/SKILL.md) with this role's artifact and recursive-review workflows for engineering documents. The [context factory index](../../README.md) and [adapters](../../shared/skill-adapters.md) identify canonical shared/engineering guidance and differences from the source toolkit; keep codebase detail with its area owner.

**Evidence:** Current root/agent links and `pnpm check:guidance`; the [engineering memory](../senior-developer/memory.md#2026-11-03--engineering-and-shared-toolkit-ownership) records coverage and verification limits. Navigation checks do not establish implementation claims or future instruction compliance.

**Why it matters:** Extend contributor guidance without duplicating product scope or implying that source-project tooling was installed.

## 2026-11-03 — Use the consolidated project documentation

The root [README](../../../README.md) owns product scope, open decisions, current implementation, and setup. The [seed guide](../../../docs/SEED.md), [interview summary](../../../docs/PREVAIL_INTERVIEW_SUMMARY.md), and [transcriptions](../../../transcriptions/full-transcription.md) remain as project references. The separate scope, roadmap, summary, catalog notes, documentation index, and reference proposal were removed at the user's request. Contributor guidance remains in `context-factory/`.

**Evidence:** The README's [product scope](../../../README.md#product-scope) and [current implementation](../../../README.md#current-implementation), plus the retained source documents. Verify local links and anchors when moving or removing guidance. This records documentation structure, not runtime verification.

**Why it matters:** Maintain one product overview and distinguish interview evidence from later decisions and implemented behavior; avoid restoring duplicate planning documents or references to removed files.
