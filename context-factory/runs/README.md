# Continue previous work

When continuing a topic, select its newest relevant run for the checkout/branch, follow any predecessor links, and confirm its claims against current Git state and affected files. A newer unrelated run does not supersede unfinished work. Historical summaries do not grant authorization.

## Write a handoff

Use [TEMPLATE](TEMPLATE.md) for a meaningful session or checkpoint on multi-session work, not every message or tool call. Name it `YYYY-MM-DD_HH-mm-ss_run-title.md` using **Asia/Manila** time and a lowercase kebab-case title. Add a short unique suffix if two writers would collide. Update your own in-progress record at a checkpoint/end; create a successor for a later run and link its predecessor.

Aim for 200–400 words. Record the goal and authorization, artifact state, result, changes/findings, evidence, outstanding work, and a concrete resume action. Link detailed decisions/checks rather than repeating them. Store lasting current rules at their canonical owner. Exclude transcripts, raw tool logs, private data, and credentials.

## Recent runs

Keep a compact index of recent/unfinished runs with topic, branch, status, and next action. Retain unresolved predecessors until a successor explicitly carries their work; find older completed runs by topic/date rather than loading the directory. Separate filenames protect parallel work; serialize shared index updates.

| Run | Topic / branch | Status | Next action |
| --- | --- | --- | --- |
| [Catalog/canvas API ownership](2026-11-18_00-07-56_catalog-canvas-layers.md) | Query, service, and utility separation / main | complete | Review scoped backend refactor; disposable regressions and Edge build passed |
| [Package canvas widget](2026-11-17_23-57-38_package-widget.md) | Package picker, linked previews and mixed workspace navigation / main | complete | Review scoped delta; local API/browser/build checks passed, hosted rollout separate |
| [Service widget navigation](2026-11-17_23-28-00_service-widget-navigation.md) | Whole-card service links and workspace overlays / main | complete | Review scoped uncommitted delta; local browser, tests, and builds passed, hosted rollout separate |
| [Service canvas widget](2026-11-17_23-12-00_service-widget.md) | Linked previews and direct service picker / main | complete | Review scoped delta; local API/browser checks passed, deploy matching contracts/API/frontend together |
| [Conversation-based booking intake](2026-11-17_00-55-00_conversation-booking-intake.md) | Existing chat to request, optional package, administrator preparation / main | complete | Review scoped diff; local migration and API/browser verification complete, hosted rollout separate |
| [Instant conversation composer](2026-11-17_00-39-13_instant-conversation-composer.md) | Immediate customer/guest bubbles and safe retries / main | complete | Review uncommitted API and browser changes together; checks and synthetic browser verification passed |
| [Anonymous conversation](2026-11-16_23-55-00_anonymous-conversation.md) | Five-message guest chat and secure account claim / main | complete | Review uncommitted implementation; local migration, API/auth/Edge and desktop/mobile verification passed |
| [AI file separation](2026-11-16_20-52-19_ai-file-separation.md) | Focused AI services, queries, and knowledge UI / feat/ai | complete | Review uncommitted refactor; behavior suites, builds, and synthetic browser checks passed |
| [Knowledge search rows](2026-11-16_20-27-00_knowledge-search-rows.md) | Top-five compact results and in-place previews / feat/ai | complete | Refresh Knowledge Catalog; title/thumbnail rows open package/service overlays |
| [Admin semantic catalog search](2026-11-16_20-13-00_admin-semantic-catalog-search.md) | Explicit-submit embedding search / feat/ai | complete | Admin can test ranked text/photo results; customer assistant retrieval and hosted rollout remain separate |
| [Admin knowledge catalog](2026-11-16_19-54-37_admin-knowledge-catalog.md) | Admin AI coverage and content inspection / feat/ai | complete | Local API/database and synthetic browser checks passed; hosted rollout and assistant retrieval remain separate |
| [Catalog embedding ingestion](2026-11-16_19-11-47_catalog-embedding-ingestion.md) | Automatic catalog text/photo embeddings and backfill / feat/ai | complete | Local backfill and automatic Edge flow verified; hosted rollout and search remain separate |
| [Catalog knowledge migration](2026-11-16_18-34-43_catalog-knowledge-migration.md) | One-table catalog corpus with 768-dimensional vectors / feat/ai | complete | Review migration; tested only in disposable databases, application deployment and ingestion/retrieval remain separate |
| [Catalog canvas validation](2026-11-16_16-56-00_catalog-canvas-validation.md) | Shared browser/API validation replacing SQL document checks / feat/ai | complete | Review scoped delta; local migration and disposable API/browser checks passed; hosted rollout remains separate |
| [Conversation AI toggle](2026-11-16_16-41-39_conversation-ai-toggle.md) | Admin toggle and automatic human takeover / feat/ai | complete | Review scoped diff; local migration and disposable API/browser checks passed; hosted rollout remains separate |
| [Catalog creation details](2026-11-16_16-34-10_catalog-creation-details.md) | Required-details modal before canvas / feat/ai | complete | Review scoped frontend delta; isolated browser checks passed, discard-confirmation cleanup stalled in browser tooling |
| [Service pricing](2026-11-16_16-19-15_service-pricing.md) | One fixed duration plus excess rate, or hourly-only / feat/ai | complete | Review unstaged pricing diff; migration applied locally and disposable browser/API checks passed; hosted rollout unverified |
| [Catalog canvas JSONB](2026-11-16_15-43-53_catalog-canvas-jsonb.md) | Entity-owned canvas arrays without document versioning / feat/ai | complete | Review scoped diff; migration applied locally, hosted deployment and real Storage uploads remain unverified |
| [AI message context](2026-11-16_14-53-07_ai-message-context.md) | Per-turn timestamp and customer-owned booking projection / feat/ai | complete | Review scoped implementation; live provider and browser behavior remain unverified |
| [Booking package details](2026-11-16_14-41-10_booking-package-details.md) | Derived inquiry package details / feat/ai | complete | Review scoped diff; migration applied locally, hosted rollout remains separate |
| [Automatic text replies](2026-11-16_14-21-59_automatic-text-replies.md) | Customer Messages history → text model → saved assistant reply / feat/ai | complete | Review scoped changes when requested; production and Gateway dashboard logs remain unverified |
| [AI domain guidance](2026-11-16_13-47-50_ai-domain-guidance.md) | AI structure, standards, examples, and task prompt / feat/ai | complete | Use the AI area for the next authorized slice; implementation remains a separate task |
| [Centralized app env](2026-11-16_13-07-35_centralized-app-env.md) | API/web environment owners / feat/ai | complete | Review or commit the scoped change when requested; live Edge and database flows remain unverified |
| [Checklist removal](2026-11-14_23-46-07_checklist-removal.md) | Complete checklist removal after venue/staff cleanup / main | complete | Review combined local diff and additive migrations before publication |
| [Venue catalog and staff removal](2026-11-14_23-28-10_catalog-staff-removal.md) | PR #26 merge and complete local removal / main | complete | Review local cleanup and coordinate its additive migration before deployment |
| [Styled by AMAC rebrand](2026-11-14_14-02-28_styled-by-amac-rebrand.md) | Visible website identity / main | complete | Review or commit the scoped rebrand when requested |
| [Messages infinite scroll](2026-11-14_12-56-00_messages-infinite-scroll.md) | Customer/admin Messages / main | complete | Review or commit together with the preceding Messages context controls when requested |
| [Messages context controls](2026-11-14_12-42-00_messages-context-controls.md) | Customer/admin Messages / main | complete | Review or commit the scoped uncommitted changes when requested |
| [Customer events timeline](2026-11-14_11-50-00_customer-events-timeline.md) | Customer My events / main | complete | Review or commit the scoped uncommitted changes when requested |
| [Catalog filter disclosure](2026-11-14_11-33-00_catalog-filter-disclosure.md) | Customer catalog refinement / main | complete | Review or commit together with the preceding catalog changes when requested |
| [Customer catalog browsing](2026-11-14_11-29-00_customer-catalog-browsing.md) | Customer catalogs / main | complete | Review or commit the scoped uncommitted changes when requested |
| [Guidance reorganization](2026-11-14_10-59-01_context-factory-reorganization.md) | Context factory / main | complete | Select the next task through the router |
