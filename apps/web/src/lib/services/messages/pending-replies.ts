import type {
  ChatConversation,
  ChatMessage,
} from "../../data/messages/conversations";

export type PendingReplies = Record<
  string,
  { conversationId: string; aiVersion: number }
>;

/** A response seen in a later poll permanently settles the local request. */
export function reconcilePendingReplies(
  pending: PendingReplies,
  conversation: ChatConversation,
  messages: ChatMessage[],
): PendingReplies {
  const next: PendingReplies = Object.fromEntries(
    Object.entries(pending).filter(
      ([, item]) =>
        item.conversationId !== conversation.id ||
        item.aiVersion > conversation.aiVersion ||
        (item.aiVersion === conversation.aiVersion && conversation.aiEnabled),
    ),
  );

  for (const message of messages) {
    if (message.senderRole !== "assistant" || !message.replyToMessageId)
      continue;

    const item = next[message.replyToMessageId];

    if (
      item?.conversationId === conversation.id &&
      item.aiVersion === conversation.aiVersion
    )
      delete next[message.replyToMessageId];
  }

  return next;
}

export function hasLocalReplyPending(
  pending: PendingReplies,
  conversation: ChatConversation,
) {
  return Object.values(pending).some(
    (item) =>
      item.conversationId === conversation.id &&
      item.aiVersion === conversation.aiVersion &&
      conversation.aiEnabled,
  );
}

/** A linked assistant reply proves this source no longer needs an acknowledgement bridge. */
export function hasObservedReply(messages: ChatMessage[], sourceId: string) {
  return messages.some(
    (message) =>
      message.senderRole === "assistant" &&
      message.replyToMessageId === sourceId,
  );
}
