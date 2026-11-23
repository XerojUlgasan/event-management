/** The anonymous allowance is enforced by the API for each conversation. */
export const GUEST_CUSTOMER_MESSAGE_LIMIT = 5;
export const GUEST_INACTIVITY_TTL_MS = 24 * 60 * 60 * 1000;

export type GuestChatStatus = {
  customerMessageCount: number;
  remainingMessages: number;
  expiresAt: string;
  loginRequired: boolean;
};

export type GuestChatErrorCode =
  "login_required" | "guest_expired" | "request_conflict";
