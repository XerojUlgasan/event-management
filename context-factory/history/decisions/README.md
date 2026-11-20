# Decisions

Create a record for a lasting architecture, business-policy, ownership, or consequential tradeoff. Routine implementation details stay with the code. Use [TEMPLATE](TEMPLATE.md) and `YYYY-MM-DD_short-title.md`; add a time suffix when names would collide.

Record authority explicitly. An agent recommendation is **proposed** until accepted by the person or requirement authorized to decide. A user-approved plan may be accepted even before implementation; record implementation state separately. Update current rules at their canonical owner and link the decision for rationale.

Preserve historical reasoning. When a decision changes, link a successor and mark the earlier record superseded. Recheck dated facts before using them. Legacy notes preserve previous role memories and may contain superseded facts; read them only for relevant history.

| Record | Status / purpose |
| --- | --- |
| [Derive conversation availability](2026-11-20_derive-conversation-availability.md) | Accepted removal of stored closure and guest deadlines; expiry follows saved activity and ownership |
| [Retire quotation acceptance](2026-11-20_retire-quotation-acceptance.md) | Accepted removal of quotation acceptance state/timestamps; admin revisions and booking-request acceptance remain |
| [Catalog indexing scheduling](2026-11-19_catalog-index-scheduling.md) | Accepted manual ensure-scheduled no-ops for active jobs; catalog saves retain refresh successors |
| [Combined catalog text](2026-11-19_combined-catalog-text.md) | Accepted one text entry per package/service across all sections, with only photo widgets indexed separately |
| [Conversation AI handoff](2026-11-19_conversation-ai-handoff.md) | Accepted latest JSONB reason/summary/pending, atomic acknowledgement, and admin attention indicator |
| [Model-selected tool use](2026-11-19_model-selected-tool-use.md) | Accepted removal of mandatory evidence selection; the model chooses direct answers or tools |
| [Assistant evidence grounding](2026-11-18_assistant-evidence-grounding.md) | Superseded by model-selected tool use; historical mandatory-selector rationale |
| [Remove package service assignments](2026-11-18_remove-package-service-assignments.md) | Accepted removal of relational included/optional assignments; linked canvas widgets remain |
| [Shared peso conversion and civil dates](2026-11-18_shared-money-and-dates.md) | Accepted shared money and calendar helpers; display, SQL, and request guards stay in their apps |
| [Catalog media owner folders](2026-11-18_catalog-media-folders.md) | Accepted owner paths for new uploads; development scope excludes existing-file migration and a move journal |
| [Public catalog search and tool-call records](2026-11-18_catalog-search-and-tool-calls.md)   | Accepted public discovery tool and many execution records per message; local implementation and verification                                           |
| [Linked service canvas widget](2026-11-17_service-widget.md) | Accepted service previews with direct picker access and no price/inclusion calculations; local implementation verified |
| [Conversation-based booking intake](2026-11-17_conversation-booking-intake.md) | Accepted existing-thread binding, optional package, and administrator preparation; local migration and verification complete |
| [Catalog embedding ingestion](2026-11-16_catalog-embedding-ingestion.md) | Accepted catalog text and actual-photo ingestion, automatic refresh and backfill; search remains separate |
| [Catalog knowledge storage](2026-11-16_catalog-knowledge-storage.md) | Accepted one-table catalog corpus with 768-dimensional vectors; migration prepared; ingestion now covered by its successor decision, retrieval pending |
| [Catalog canvas application validation](2026-11-16_catalog-canvas-application-validation.md) | Accepted shared browser/API document rules replacing the SQL validator |
| [Booking package details](2026-11-16_booking-package-details.md) | Accepted current-package reads replacing inquiry snapshots |
| [Entity-owned catalog canvas JSONB](2026-11-16_catalog-canvas-jsonb.md) | Accepted owner JSONB canvas arrays without document versioning |
| [Guidance organization](2026-11-14_guidance-organization.md) | Accepted structure and routing policy |
| [Legacy engineering notes](legacy-engineering-notes.md) | Historical pointers; verify against current source |
| [Legacy documentation notes](legacy-documentation-notes.md) | Historical pointers; verify against current source |
