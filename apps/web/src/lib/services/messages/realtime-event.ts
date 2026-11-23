import { realtimeEventSchema } from "@event-management/contracts/realtime-events";
import type {
  ChatMessage,
  ChatThread,
} from "../../data/messages/conversations";
import { addSentMessagesToConversation } from "./merge-thread";

export function applyRealtimeMessage(
  current: ChatThread | null,
  conversationId: string,
  payload: unknown,
): { thread: ChatThread | null; message: ChatMessage | null } {
  // Supabase Broadcast adds a transport ID outside the canonical event.
  const canonical =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? Object.fromEntries(
          Object.entries(payload).filter(([key]) => key !== "id"),
        )
      : payload;

  const parsed = realtimeEventSchema.safeParse(canonical);

  if (!parsed.success || parsed.data.conversationId !== conversationId)
    return { thread: current, message: null };

  return {
    thread: addSentMessagesToConversation(current, conversationId, [
      parsed.data.message,
    ]),
    message: parsed.data.message,
  };
}

export function isCurrentSubscription(
  subscriptionId: string,
  subscriptionAdmin: boolean,
  current: { id: string | null; enabled: boolean; admin: boolean },
) {
  return (
    current.enabled &&
    current.id === subscriptionId &&
    current.admin === subscriptionAdmin
  );
}

export function isIncomingMessage(admin: boolean, message: ChatMessage) {
  return admin
    ? message.senderRole === "customer"
    : message.senderRole !== "customer";
}

export function isPermanentTokenFailure(status: number) {
  return status === 401 || status === 403 || status === 404;
}

// Assistant messages can be ordinary replies or human-handoff acknowledgements;
// the inline DTO does not distinguish them, so the AI state needs a refresh.
export function shouldRefreshAiMetadata(
  conversation: Pick<
    ChatThread["conversation"],
    "aiEnabled" | "aiReplyPending" | "aiHandoff"
  >,
  message: ChatMessage,
) {
  return (
    !!message.processing?.replyPending ||
    ((message.senderRole === "assistant" || message.senderRole === "admin") &&
      (conversation.aiEnabled ||
        !!conversation.aiReplyPending ||
        (message.senderRole === "admin" && !!conversation.aiHandoff?.pending)))
  );
}

// A token may be capped by the session cookie. When expiry stops advancing,
// avoid repeatedly reconnecting in its final minute.
export function realtimeRefreshDelay(
  expiresAt: number,
  now: number,
  previousExpiry?: number,
) {
  const remaining = expiresAt - now;

  if (previousExpiry !== undefined && expiresAt <= previousExpiry)
    return remaining > 5_000 ? remaining - 5_000 : null;

  return remaining > 120_000
    ? remaining - 60_000
    : Math.max(1_000, Math.floor(remaining / 2));
}
