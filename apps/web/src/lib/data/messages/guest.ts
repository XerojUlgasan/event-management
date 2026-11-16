import type { GuestChatStatus } from "@event-management/contracts/guest-chat";
import { request } from "../../http/request";
import type { ChatConversation, ChatMessage } from "./conversations";

export type GuestState = GuestChatStatus;
export type GuestThread = {
  conversation: ChatConversation;
  messages: ChatMessage[];
  nextCursor: string | null;
  guest: GuestState;
};
export const startGuestChat = () =>
  request<GuestThread>("/guest/conversation", {});
export const getGuestChat = (id: string, cursor?: string) =>
  request<GuestThread>(
    `/guest/conversations/${encodeURIComponent(id)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
export const sendGuestMessage = (id: string, body: string, requestId: string) =>
  request<{
    message: ChatMessage;
    assistantMessage: ChatMessage | null;
    assistantError: string | null;
    guest: GuestState;
  }>(`/guest/conversations/${encodeURIComponent(id)}/messages`, {
    body,
    requestId,
  });
export const claimGuestChat = (id: string) =>
  request<{ conversationId: string }>(
    `/guest/conversations/${encodeURIComponent(id)}/claim`,
    {},
  );
