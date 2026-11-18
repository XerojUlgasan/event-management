import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function serviceError<S extends ContentfulStatusCode>(
  message: string,
  status: S,
) {
  return { message, status };
}

export function jsonError<S extends ContentfulStatusCode>(
  c: Context,
  message: string,
  status: S,
) {
  return c.json({ error: message }, status);
}
