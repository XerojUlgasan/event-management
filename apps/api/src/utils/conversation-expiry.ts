export const CONVERSATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Package conversations remain available until 24 hours after the event end;
// unqualified conversations expire 24 hours after they were created.
export function conversationExpiresAt(
  packageId: string | null,
  eventEndsAt: Date | null,
  createdAt: Date,
) {
  return new Date(
    (packageId && eventEndsAt ? eventEndsAt : createdAt).getTime() + CONVERSATION_EXPIRY_MS,
  );
}
