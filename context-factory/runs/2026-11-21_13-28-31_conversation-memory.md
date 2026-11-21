# AMAC AI conversation memory

Started: 2026-11-21T13:28:31+08:00
Updated: 2026-11-21T13:37:49+08:00
Status: complete
Scope: Add server-side conversation memory to normal assistant turns. Verification uses disposable PostgreSQL and synthetic model responses.
Checkout: main at affda16, initially clean.
Continues: [AI human handoff](2026-11-19_00-57-12_ai-human-handoff.md).

## Goal

AMAC AI can remember important details and decisions from the current conversation and repair its note when it finds missing or outdated information in the saved messages.

## Result

One nullable Markdown field on the conversation follows the existing guest claim and booking link. The assistant receives the note alongside its own saved chat history. The optional tool replaces the note under the conversation lock after checking the owner, turn, latest customer message, and previous note. The audit stores bounded metadata and status. An older turn can still answer using its own saved messages.

## Decisions

See the [accepted decision](../history/decisions/2026-11-21_conversation-memory.md). Notes are limited to 2,000 UTF-16 code units. Their serialized size has a separate allowance that preserves the existing proposal and history limits.

## Verification

- Disposable PostgreSQL 17 passed 111 assistant, guest, message, image-job and RLS tests. A separate migration upgrade preserved an existing conversation and message with null memory. Prisma validation and schema diff passed. Both client roles lacked direct read access to the new column.
- API source types, isolated Edge build, focused lint, formatting and guidance checks passed. The full API check retains the baseline `PoolClient.processID` test typing error. The full messages script also retains the baseline historical fixture failure from a missing `notifications` table. Both reproduced at affda16.
- Independent review approved after two repair cycles. Requested routing used Terra for exploration and tests and Sol for code and review. Actual model metadata is unconfirmed.

## Remaining work

Live model behavior and deployed Edge execution remain unverified. Verification used task-owned services and database fixtures.

## Resume here

Apply the additive migration on the intended database before rolling out the matching API and worker. Use the [assistant walkthrough](../areas/ai/references/code-examples.md#conversation-memory) to locate the note and its tool.
