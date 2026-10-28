import type { ChatThread } from "../../../lib/api"

// Keep locally confirmed messages if a poll that started before the send returns without them.
export function mergeThread(current: ChatThread | null, next: ChatThread): ChatThread {
  if (!current || current.conversation.id !== next.conversation.id) return next
  const known = new Set(next.messages.map((message) => message.id))
  const pending = current.messages.filter((message) => !known.has(message.id))
  if (!pending.length) return next
  return {
    conversation: next.conversation,
    messages: [...next.messages, ...pending].sort(
      (first, second) =>
        first.createdAt.localeCompare(second.createdAt) || first.id.localeCompare(second.id),
    ),
  }
}
