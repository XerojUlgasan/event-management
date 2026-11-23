import { ApiError } from "../../http/request";

/** Keep explicit API details while identifying unavailable refreshes accurately. */
export function conversationLoadError(cause: unknown, fallback: string) {
  if (
    cause instanceof TypeError ||
    (cause instanceof ApiError && cause.status >= 500)
  )
    return fallback;

  if (cause instanceof Error && cause.message.trim()) return cause.message;

  if (typeof cause === "string" && cause.trim()) return cause;

  return fallback;
}
