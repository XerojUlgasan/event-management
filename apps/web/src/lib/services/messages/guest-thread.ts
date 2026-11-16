import type { GuestThread } from "../../data/messages/guest";
import type { ChatMessage } from "../../data/messages/conversations";

export function mergeGuestMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
  older = false,
) {
  const seen = new Set<string>();
  return (
    older ? [...incoming, ...existing] : [...existing, ...incoming]
  ).filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}
export function mergeGuestThread(
  current: GuestThread | null,
  next: GuestThread,
  older = false,
): GuestThread {
  if (!current || current.conversation.id !== next.conversation.id) return next;
  // If a polling page has no overlap, keep its server boundary so older pages
  // can fill the gap instead of silently presenting a discontinuous history.
  const gap =
    !older &&
    !!next.nextCursor &&
    current.messages.length > 0 &&
    next.messages.length > 0 &&
    !next.messages.some((message) =>
      current.messages.some((old) => old.id === message.id),
    );
  if (gap) return next;
  return {
    ...next,
    messages: mergeGuestMessages(current.messages, next.messages, older),
    nextCursor: older ? next.nextCursor : current.nextCursor,
  };
}

export type PendingGuestSend = { body: string; requestId: string };
/** An uncertain delivery is retried with the original key and payload. */
export function prepareGuestSend(
  pending: PendingGuestSend | null,
  draft: string,
  createId: () => string,
): PendingGuestSend | null {
  if (pending) return pending;
  const body = draft.trim();
  return body ? { body, requestId: createId() } : null;
}
