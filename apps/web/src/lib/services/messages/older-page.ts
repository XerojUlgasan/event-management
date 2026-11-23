export function assertCursorMoved(
  nextCursor: string | null,
  requestedCursor: string,
  message = "Unable to load older messages. Please try again.",
) {
  if (nextCursor === requestedCursor) throw new Error(message);
}
