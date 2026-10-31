import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { claimGuestHistoryData } from "../../data/messages/claim-guest-history.js";
import type { GuestHistoryMessage } from "../../data/messages/claim-guest-history.js";
import { ensureUnboundConversationData, findGuestConversationData } from "../../data/messages/ensure-conversation.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { updateConversationContextData } from "../../data/messages/update-conversation.js";
import {
  conversationContextValues,
  eventWindowInvalid,
  type ConversationContextInput,
} from "./update-conversation-context.js";
import { getConversationThreadService } from "./get-conversation-thread.js";

export async function claimGuestConversationService(
  db: Kysely<DB>,
  customerId: string,
  guestChatId: string,
  messages: GuestHistoryMessage[],
  context?: ConversationContextInput,
) {
  await expireConversationsData(db);
  const existingGuestConversation = await findGuestConversationData(db, customerId, guestChatId);
  const conversation = existingGuestConversation ?? await ensureUnboundConversationData(db, customerId);
  if (existingGuestConversation) {
    return {
      kind: "ok" as const,
      thread: await getConversationThreadService(db, conversation, "customer"),
    };
  }
  const contextValues = context ? await conversationContextValues(db, context) : {};
  if (contextValues === null) return { kind: "invalid-package" as const };
  if (eventWindowInvalid(conversation, contextValues)) {
    return { kind: "invalid-dates" as const };
  }
  await claimGuestHistoryData(db, conversation, guestChatId, messages);
  if (Object.keys(contextValues).length) {
    await updateConversationContextData(db, conversation, contextValues);
  }
  const updated = await findGuestConversationData(db, customerId, guestChatId);
  if (!updated) return { kind: "invalid-dates" as const };
  return {
    kind: "ok" as const,
    thread: await getConversationThreadService(db, updated, "customer"),
  };
}
