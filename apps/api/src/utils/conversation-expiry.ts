export const CONVERSATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Event conversations remain available until 24 hours after the event end;
// general conversations expire 24 hours after their last activity.
export function conversationExpiresAt(eventEndsAt: Date | null, updatedAt: Date) {
  return new Date((eventEndsAt ?? updatedAt).getTime() + CONVERSATION_EXPIRY_MS);
}
