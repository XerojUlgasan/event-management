import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_CURSOR_LENGTH,
} from "@event-management/contracts/pagination";
import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

export const paginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional(),
});
export const pageInfoSchema = z.object({ nextCursor: z.string().nullable() });
// PostgreSQL has no ISO year zero and limits numeric timezone displacement.
export const postgresDateSchema = z.iso
  .date()
  .refine((value) => !value.startsWith("0000-"), "Invalid date");
export const postgresTimestampSchema = z.iso
  .datetime({ offset: true })
  .refine((value) => {
    const offset = value.match(/([+-])(\d{2}):(\d{2})$/);
    return (
      !value.startsWith("0000-") &&
      Number.isFinite(Date.parse(value)) &&
      (!offset || Number(offset[2]) < 16)
    );
  }, "Invalid timestamp");
export function encodePageCursor(scope: string, position: unknown): string {
  return Buffer.from(JSON.stringify({ version: 1, scope, position })).toString(
    "base64url",
  );
}
/** Scope binds a cursor to its domain, parent/owner, sort, and normalized filters. */
export function parsePageCursor<T>(
  cursor: string | undefined,
  schema: z.ZodType<T>,
  scope: string,
): T | undefined {
  if (cursor === undefined) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > MAX_CURSOR_LENGTH)
      throw new Error();
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.toString("base64url") !== cursor) throw new Error();
    const parsed = z
      .strictObject({
        version: z.literal(1),
        scope: z.literal(scope),
        position: schema,
      })
      .safeParse(JSON.parse(bytes.toString("utf8")));
    if (!parsed.success) throw new Error();
    return parsed.data.position;
  } catch {
    const message =
      "Invalid pagination cursor. Start again from the first page.";
    throw new HTTPException(400, {
      message,
      res: new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    });
  }
}
