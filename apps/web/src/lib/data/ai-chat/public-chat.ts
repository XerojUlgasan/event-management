import { request } from "../../http/request";

export type GuestChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type GuestChatResponse = {
  reply: string;
};

/** Stateless public AI chat — no session required. The client owns the history. */
export const sendGuestChat = (
  message: string,
  history?: GuestChatHistoryItem[],
) =>
  request<GuestChatResponse>("/ai-chat/guest", {
    message,
    history,
  });
