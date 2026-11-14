# Guidance routing scenarios

For contributor-guidance changes, walk each affected row from root AGENTS.md through the task router. Inspect target content, not only link existence. Automated checks validate structural routes; this table records semantic expectations. A route selects applicable references, not every linked document.

| Scenario | Expected route and completion boundary |
| --- | --- |
| Explain package saving, no edits | Engineering → Investigate → API structure + frontend client layers. Explain actual request/service/query/result; no changes or invented generated client. |
| CSS-only adjustment, mock page, shared color | Frontend + packages → project structure + mandatory reuse → relevant styling/theme/UI references. Inspect exports/stories/tokens; complete reuse audit and rendered checks. |
| Shared component or registry/shadcn addition | Frontend + packages → reuse + components/Storybook + shadcn when installing. Inspect configured destinations/dependencies; verify consuming views and stories. |
| Authentication/session permission change | API → auth/sessions + verification; matching identity/business rules. Add frontend auth only for affected browser flow. Check authorization at API boundary. |
| Message field/file/collection limit | Contracts → shared limits + API type sync; API schema/body caps and relevant frontend hints. Follow authoritative constant and behavior checks; every UI edit still requires reuse. |
| Booking status/schema/migration review | Review → API structure/database + matching booking rules + contract-change trace; QA for authorized isolated proof. Stay read-only; accepted inquiry is not reserved/confirmed. |
| Narrow TypeScript bug | Owning area + Implement → TypeScript; Investigate for reproduction and root cause; TDD for explicit or practical regression proof. No unrelated framework work. |
| Change staffing responsibility | Business → identity + staffing → affected API/frontend; inspect actual permissions separately. Coordinator is an event assignment held by staff. |
| Seed one table | QA → seed-one-table + canonical seed coverage; API database + affected business rules. Stable IDs, valid parents/state, insert-only rerun proof in disposable DB. |
| Repository guide edit | Documentation → docs + technical writing → affected owners/incoming references. Run guidance checks; research/defense is not mandatory. |
| Whole-paper polish or literature/defense | Documentation → recursive review, plus Research's relevant source/method/defense workflow. Check full scope, citations, evidence, prose, and final rendered artifact. |
| Prepare/open PR | Pull requests → requested base/complete diff → review + relevant checks. PR preparation does not authorize merge/deploy. |
| Resume unfinished work | Runs index → newest relevant topic/checkout → predecessor and linked decisions/checks. Confirm current Git/source; preserve outstanding work and original authorization. |
| Record a new choice or check | History decision/verification index → matching template. Proposal is not approval; old passes do not establish current behavior. |

## Checks

Run `pnpm check:guidance` for links/anchors, metadata, reachability, obsolete paths, and required routing edges. Run `pnpm test:guidance` for valid and deliberately broken fixtures. Neither executes application behavior or guarantees future compliance. For relocated QA helpers, check syntax and `--help` without authenticating or opening a DB connection.
