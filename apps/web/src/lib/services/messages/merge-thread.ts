import type { ChatThread } from "../../data/messages/conversations";

// Page order comes from PostgreSQL, whose microsecond precision is lost in DTO dates.
// Keep that order rather than sorting serialized timestamps in the browser.
export function mergeThread(
  current: ChatThread | null,
  next: ChatThread,
): ChatThread {
  if (!current || current.conversation.id !== next.conversation.id) return next;
  if (!next.messages.length)
    return {
      ...next,
      messages: current.messages,
      nextCursor: current.nextCursor,
    };
  const nextIds = new Set(next.messages.map((message) => message.id));
  const firstOverlap = current.messages.findIndex((message) =>
    nextIds.has(message.id),
  );
  const lastOverlap = current.messages.findLastIndex((message) =>
    nextIds.has(message.id),
  );
  const prefix =
    firstOverlap < 0
      ? current.messages
      : current.messages.slice(0, firstOverlap);
  const suffix =
    lastOverlap < 0
      ? []
      : current.messages
          .slice(lastOverlap + 1)
          .filter((message) => !nextIds.has(message.id));
  return {
    ...next,
    messages: [...prefix, ...next.messages, ...suffix],
    nextCursor: current.nextCursor,
  };
}

export function prependOlder(
  current: ChatThread,
  older: ChatThread,
): ChatThread {
  const known = new Set(current.messages.map((message) => message.id));
  return {
    ...current,
    messages: [
      ...older.messages.filter((message) => !known.has(message.id)),
      ...current.messages,
    ],
    nextCursor: older.nextCursor,
  };
}

// An optimistic, confirmed send is not proof that the intervening server pages
// were loaded. Only a message previously fetched from the server anchors them.
export function threadHasGap(
  current: ChatThread | null,
  next: ChatThread,
  localOnlyIds: ReadonlySet<string> = new Set(),
) {
  return (
    !!current &&
    current.conversation.id === next.conversation.id &&
    !!next.nextCursor &&
    current.messages.length > 0 &&
    next.messages.length > 0 &&
    !next.messages.some(
      (message) =>
        !localOnlyIds.has(message.id) &&
        current.messages.some((old) => old.id === message.id),
    )
  );
}

// Start from the server's newest boundary if a burst left an unseen gap.
// Keep confirmed sends that have not yet appeared in the fetched page.
export function mergePolledThread(
  current: ChatThread | null,
  next: ChatThread,
  localOnlyIds: ReadonlySet<string>,
) {
  const gap = threadHasGap(current, next, localOnlyIds);
  if (!gap || !current)
    return { thread: mergeThread(current, next), gap: false };
  const nextIds = new Set(next.messages.map((message) => message.id));
  return {
    thread: {
      ...next,
      messages: [
        ...next.messages,
        ...current.messages.filter(
          (message) => localOnlyIds.has(message.id) && !nextIds.has(message.id),
        ),
      ],
    },
    gap: true,
  };
}
