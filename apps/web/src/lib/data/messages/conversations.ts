import type { AiHandoff } from "@event-management/contracts/ai-handoff";
import type {
  MessageImage,
  MessageProcessing,
} from "@event-management/contracts/message-images";
import { request } from "../../http/request";

export type ConversationStatus = "active" | "closed";

export type ChatMessage = {
  id: string;
  quotationId: string | null;
  body: string;
  senderId: string | null;
  senderRole: "admin" | "customer" | "assistant";
  replyToMessageId?: string | null;
  senderName: string;
  createdAt: string;
  readAt: string | null;
  images?: MessageImage[];
  pendingFiles?: File[];
  processing?: MessageProcessing | null;
};

export type ChatConversation = {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  packageId: string | null;
  packageName: string | null;
  bookingRequestId: string | null;
  bookingRequestReference: string | null;
  eventType: string | null;
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  guestCount: number | null;
  status: ConversationStatus;
  closedAt: string | null;
  aiEnabled: boolean;
  aiReplyPending?: boolean;
  aiVersion: number;
  aiHandoff?: AiHandoff | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: string;
};

export type ChatThread = {
  conversation: ChatConversation;
  messages: ChatMessage[];
  nextCursor: string | null;
};

export function messagePayload(
  body: string,
  images: File[],
  fields: Record<string, string | undefined>,
) {
  if (!images.length) return { body, ...fields };

  const form = new FormData();
  form.set("body", body);

  for (const [key, value] of Object.entries(fields))
    if (value !== undefined) form.set(key, value);

  images.forEach((image) => form.append("images", image));

  return form;
}

const cursorQuery = (cursor?: string) =>
  cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";

export const getMyConversation = () =>
  request<ChatThread>("/messages/conversation");

export const createMyConversation = () =>
  request<ChatThread>("/messages/conversations", {});

export const getMyConversations = (cursor?: string, reference?: string) => {
  const query = new URLSearchParams();

  if (cursor) query.set("cursor", cursor);

  if (reference) query.set("reference", reference);

  return request<{
    conversations: ChatConversation[];
    nextCursor: string | null;
  }>(`/messages/conversations${query.size ? `?${query}` : ""}`);
};

export const getMyConversationById = (id: string, cursor?: string) =>
  request<ChatThread>(
    `/messages/conversations/${encodeURIComponent(id)}${cursorQuery(cursor)}`,
  );

export const sendMyMessage = (
  body: string,
  conversationId?: string,
  requestId?: string,
  images: File[] = [],
) =>
  request<{
    message: ChatMessage;
    assistantMessage: ChatMessage | null;
    assistantError: string | null;
  }>(
    "/messages/conversation/messages",
    messagePayload(body, images, { conversationId, requestId }),
  );

export const getAdminConversations = (cursor?: string) =>
  request<{ conversations: ChatConversation[]; nextCursor: string | null }>(
    `/admin/conversations${cursorQuery(cursor)}`,
  );

export const getAdminConversation = (id: string, cursor?: string) =>
  request<ChatThread>(
    `/admin/conversations/${encodeURIComponent(id)}${cursorQuery(cursor)}`,
  );

export const sendAdminMessage = (
  id: string,
  body: string,
  requestId: string,
  images: File[] = [],
) =>
  request<{
    message: ChatMessage;
    aiEnabled: boolean;
    aiVersion: number;
    aiHandoff: AiHandoff | null;
  }>(
    `/admin/conversations/${encodeURIComponent(id)}/messages`,
    messagePayload(body, images, { requestId }),
  );

export const retryMyMessageProcessing = (id: string, messageId: string) =>
  request<{ message: ChatMessage }>(
    `/messages/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/retry`,
    {},
  );

export const retryAdminMessageProcessing = (id: string, messageId: string) =>
  request<{ message: ChatMessage }>(
    `/admin/conversations/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}/retry`,
    {},
  );

export const updateAdminConversationAi = (
  id: string,
  aiEnabled: boolean,
  expectedAiVersion: number,
) =>
  request<{
    aiEnabled: boolean;
    aiVersion: number;
    aiHandoff: AiHandoff | null;
  }>(
    `/admin/conversations/${encodeURIComponent(id)}/ai`,
    { aiEnabled, expectedAiVersion },
    undefined,
    "PATCH",
  );
