import { chatMessageSchema } from "@event-management/contracts/messages";
import type { ChatMessage } from "../../data/messages/conversations";

export function latestSuggestedReplyMessage(messages: ChatMessage[]) {
  if (messages.at(-1)?.senderRole !== "assistant") return;

  const latestCustomer = messages.findLast(
    (message) => message.senderRole === "customer",
  );

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];

    if (message.senderRole !== "assistant") return;

    // Skip delayed older turns when a newer customer message is visible.
    if (
      !(index === messages.length - 1 && message.handoffAcknowledgement) &&
      message.replyToMessageId &&
      latestCustomer &&
      message.replyToMessageId !== latestCustomer.id
    )
      continue;

    const replies = chatMessageSchema.shape.suggestedReplies.safeParse(
      message.suggestedReplies,
    );

    if (!replies.success || !replies.data?.length) return;

    return { id: message.id, replies: [...new Set(replies.data)] };
  }
}
