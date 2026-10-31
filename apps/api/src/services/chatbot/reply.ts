import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { MessageWithSender } from "../../data/messages/types.js";
import { createMessageData } from "../../data/messages/create-message.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { listThreadMessagesData } from "../../data/messages/list-thread-messages.js";
import { messageDto } from "../messages/message-response.js";
import { getPublicPackageService } from "../packages/get-public-package.js";
import {
  buildAssistantSystemPrompt,
  conversationContext,
  type ChatTurn,
  type GuestContext,
} from "./context.js";
import { generateGeminiReply } from "./gemini.js";

export type GuestHistory = { role: "user" | "assistant"; body: string };

function turnsFromHistory(messages: GuestHistory[]): ChatTurn[] {
  return messages.slice(-30).map((message) => ({
    role: message.role === "user" ? "user" : "model",
    text: message.body,
  }));
}

function turnsFromThread(messages: MessageWithSender[]): ChatTurn[] {
  return messages.filter((message) => message.sender_role !== "system").slice(-30).map((message) => ({
    role: message.sender_role === "customer" ? "user" : "model",
    text:
      message.sender_role === "admin"
        ? `Staff member: ${message.body}`
        : message.body,
  }));
}

export async function replyToGuestService(
  db: Kysely<DB>,
  messages: GuestHistory[],
  context: GuestContext,
) {
  const packageName = context.packageId
    ? (await getPublicPackageService(db, context.packageId))?.name ?? null
    : null;
  const systemPrompt = await buildAssistantSystemPrompt(db, context, packageName);
  return generateGeminiReply(systemPrompt, turnsFromHistory(messages));
}

export async function replyToConversationService(db: Kysely<DB>, customerId: string) {
  await expireConversationsData(db);
  const conversation = await ensureConversationData(db, customerId);
  if (conversation.status !== "active") {
    return { kind: "paused" as const, status: conversation.status };
  }
  const messages = await listThreadMessagesData(db, conversation.id);
  const turns = turnsFromThread(messages);
  if (turns.at(-1)?.role !== "user") {
    return { kind: "paused" as const, status: conversation.status };
  }
  const systemPrompt = await buildAssistantSystemPrompt(
    db,
    conversationContext(conversation),
    conversation.package_name,
    true,
  );
  const text = await generateGeminiReply(systemPrompt, turns);

  // Staff may have taken over while Gemini was generating.
  const latest = await findConversationData(db, conversation.id);
  if (!latest || latest.status !== "active") {
    return { kind: "paused" as const, status: latest?.status ?? "closed" };
  }
  const message = await createMessageData(db, latest, null, "assistant", text);
  return { kind: "ok" as const, message: messageDto(message), status: "active" as const };
}
