# Public catalog search and tool-call records

Date: 2026-11-18
Status: accepted
Authority: User requested implementation of the first catalog-search tool, approved a separate persistence table, and required multiple tool calls per triggering and resulting message with a tool key/type.
Implementation: implemented locally; verification and deployment limits are recorded in the linked run.

## Problem

The text assistant could read conversation history and a small booking-request projection but could not search catalog records. Tool execution also needed its own audit identity because one customer message and one resulting assistant reply can each relate to several calls, and a failed or suppressed turn may have no reply.

## Decision

- Expose only `searchPublicCatalog` in this slice. Its model inputs are catalog type, optional semantic query, price bounds, package capacity or service pricing type, and a scoped continuation cursor. Identity, conversation, triggering message, AI version, and turn identity remain server-owned.
- Return up to five unique public listings with current PHP pricing terms, capacity, bounded descriptions/evidence, and public links. Exact public filters precede selection of fresh compatible semantic matches. Queryless browsing requires no embeddings. Search failure is distinct from no results.
- Store each validated execution in `ai_tool_calls`, identified by a UUID and unique `(turn_id, tool_call_id)`, with `tool_name`, required triggering customer-message FK, optional resulting assistant-message FK, bounded input/output JSON, status, sanitized error code, and timing. Neither message FK is unique. SQL enforces message roles and same-conversation reply links; RLS and revoked grants keep the table server-only.
- Commit resulting-message links with the assistant reply. Completed calls remain traceable without a reply after provider failure or takeover. Started rows can remain after process interruption; these records do not schedule retries or authorize replay.
- For later "show more" requests, load only validated search inputs and the continuation cursor from a successful call associated with an earlier delivered reply in this conversation. Do not replay stored prices as current facts.

## Alternatives considered

- Store calls on the assistant message: compact but cannot record failures before that message exists, and obscures the many-call relationship.
- Store tool metadata in ordinary chat messages: changes customer/admin history and unread semantics and mixes execution records with customer-visible content.
- Separate tools for packages and services: viable, but the approved catalog-type input keeps the shared discovery operation in one tool while validating type-specific filters.

## Consequences

Deploy the additive migration with the matching API before using assistant turns. There is no tool-trace UI/read API, new private tool, inquiry submission, automatic handoff, or commitment behavior in this change. Tool inputs can contain customer-provided search terms and require the same restricted handling as other conversation-associated records. A strict retention policy and administrative trace interface remain separate work.

## References

- [Root implementation and setup](../../../README.md#current-implementation)
- [AI execution standards](../../areas/ai/references/standards-and-verification.md#catalog-tool-execution-and-audit-records)
- [Implementation run](../../runs/2026-11-18_00-28-54_catalog-search-tool.md)
