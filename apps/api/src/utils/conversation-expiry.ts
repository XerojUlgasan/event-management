export const CONVERSATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// General conversations expire 24 hours after creation. Booking conversations
// stay open while the request is active; once an event end is known they close
// 24 hours after it, unless a customization request is still pending.
export function conversationExpiresAt(
  eventEndsAt: Date | null,
  createdAt: Date,
  options?: { keepOpen?: boolean },
): Date | null {
  if (options?.keepOpen) return null;
  return new Date(
    (eventEndsAt ?? createdAt).getTime() + CONVERSATION_EXPIRY_MS,
  );
}
