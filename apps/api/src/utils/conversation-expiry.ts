export const CONVERSATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Booking conversations expire 24 hours after the event end when known.
// Otherwise they expire 24 hours after creation.
export function conversationExpiresAt(
  eventEndsAt: Date | null,
  createdAt: Date,
) {
  return new Date(
    (eventEndsAt ?? createdAt).getTime() + CONVERSATION_EXPIRY_MS,
  );
}
