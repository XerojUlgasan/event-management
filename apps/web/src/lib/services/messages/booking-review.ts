import type { ChatMessage } from "../../data/messages/conversations";

// Capture the review displayed as the last message in the loaded thread. The
// server checks authoritative message order and consent on every submission.
export function displayedReviewForReply(
  messages: ChatMessage[],
  hasImages: boolean,
) {
  const last = messages.at(-1);

  return !hasImages && last?.senderRole === "assistant" ? last.id : undefined;
}

// A null pin means composition began without a review. Undefined means there is
// no active composition. Never replace a pin when later messages arrive.
export function reviewForComposition(
  previousText: string,
  nextText: string,
  pinned: string | null | undefined,
  messages: ChatMessage[],
) {
  if (!nextText) return undefined;

  if (!previousText || pinned === undefined)
    return displayedReviewForReply(messages, false) ?? null;

  return pinned;
}

export function reviewForSend(
  pinned: string | null | undefined,
  hasImages: boolean,
) {
  // Preserve the original context even if newer messages arrive. The server
  // decides whether the reply is approval and checks the review's freshness.
  return hasImages ? undefined : (pinned ?? undefined);
}

export function retryableSubmissionError(
  message: ChatMessage,
  assistantError: string | null,
) {
  return Boolean(
    assistantError && message.reviewMessageId && !message.pendingFiles?.length,
  );
}

// A saved customer message does not mean its submission finished. Keep the
// original retry payload until an assistant reply confirms the turn completed.
export function reconcileSubmissionRetries<T extends { message: ChatMessage }>(
  outbox: Record<string, T>,
  messages: ChatMessage[],
) {
  const next = { ...outbox };

  for (const message of messages) {
    if (!next[message.id]?.message.reviewMessageId) delete next[message.id];

    if (message.senderRole === "assistant" && message.replyToMessageId)
      delete next[message.replyToMessageId];
  }

  return next;
}
