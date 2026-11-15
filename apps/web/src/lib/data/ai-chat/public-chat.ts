import { request } from "../../http/request";

/** A single turn in a guest chat conversation. */
export type GuestTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GuestChatResponse = {
  reply: string;
  showBookCta: boolean;
};

export type ClaimGuestChatResponse = {
  conversationId: string;
  savedCount: number;
};

/** Stateless public AI chat — no session required. The client owns the history. */
export const sendGuestChat = (message: string, history?: GuestTurn[]) =>
  request<GuestChatResponse>("/ai-chat/guest", { message, history });

/** Saves a guest conversation to the signed-in customer's Messages after login.
 *  Requires a valid customer session cookie. */
export const claimGuestChat = (turns: GuestTurn[]) =>
  request<ClaimGuestChatResponse>("/ai-chat/claim", { turns });
