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

// Preserve fetched order, inserting late send responses by timestamp. Equal
// timestamps keep their known order because DTOs lose database precision.
export function addGuestSentMessages(
  existing: ChatMessage[],
  sent: ChatMessage[],
) {
  const messages = [...existing];

  for (const [index, message] of sent.entries()) {
    if (messages.some((item) => item.id === message.id)) continue;

    const following = new Set(sent.slice(index + 1).map((item) => item.id));

    const at = messages.findIndex(
      (item) => following.has(item.id) || item.createdAt > message.createdAt,
    );

    messages.splice(at < 0 ? messages.length : at, 0, message);
  }

  return messages;
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

  if (older)
    return {
      ...next,
      messages: mergeGuestMessages(current.messages, next.messages, true),
      nextCursor: next.nextCursor,
    };

  const ids = new Set(next.messages.map((message) => message.id));

  const first = current.messages.findIndex((message) => ids.has(message.id));

  const last = current.messages.findLastIndex((message) => ids.has(message.id));

  const prefix =
    first < 0 ? current.messages : current.messages.slice(0, first);

  const suffix =
    last < 0
      ? []
      : current.messages
          .slice(last + 1)
          .filter((message) => !ids.has(message.id));

  return {
    ...next,
    messages: [...prefix, ...next.messages, ...suffix],
    nextCursor: current.nextCursor,
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

/** Reserve a slot for each unresolved request until its outcome is known. */
export function guestRemaining(remaining: number, unresolved: number) {
  return Math.max(0, remaining - unresolved);
}

/** Concurrent replies can arrive out of order, so allowance cannot increase. */
export function mergeGuestAllowance(current: number, incoming: number) {
  return Math.min(current, incoming);
}
