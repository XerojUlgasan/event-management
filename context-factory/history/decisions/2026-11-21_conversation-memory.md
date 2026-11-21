# Markdown memory on the conversation

Date: 2026-11-21
Status: accepted
Authority: The user chose one Markdown note on the conversation and approved updates during normal assistant replies.
Implementation: [Conversation memory data](../../../apps/api/src/data/messages/conversation-memory.ts) and [assistant tool](../../../apps/api/src/services/ai/tools/update-conversation-memory.ts).

## Decision

Store the latest note in nullable `conversations.conversation_memory`. The note summarizes durable developments in the chat, including choices, corrections, team statements, and unresolved questions. The assistant uses it alongside the saved transcript and current business records. The model can choose to update it during its normal reply. The API validates the input and binds updates to the authorized conversation and customer message.

## Rationale

The note shares the conversation’s ownership and lifecycle. Guest sign-in claims that same row. Markdown can represent details and decisions that differ across chats. A separate table would support independently retained versions, which would introduce a second lifecycle for this single current note.

## Consequences

The note stays server-side. The execution audit records metadata about the update. Normal customer or guest replies can repair omissions using the saved messages, including earlier messages from the AMAC team after AI resumes. [Assistant walkthrough](../../areas/ai/references/code-examples.md#conversation-memory)
