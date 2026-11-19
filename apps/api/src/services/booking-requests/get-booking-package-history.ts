import { z } from "@hono/zod-openapi";
import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { publicSchema } from "../../controllers/packages/schemas.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { listCustomPackageHistoryData } from "../../data/booking-requests/list-custom-package-history.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";

const positionSchema = z.object({
  createdAt: z.iso
    .datetime()
    .refine(
      (value) =>
        !value.startsWith("0000-") &&
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value),
    ),
  id: z.string().uuid(),
});

export async function getBookingPackageHistoryService(
  db: Kysely<DB>,
  id: string,
  input: { limit: number; cursor?: string },
) {
  if (!(await findBookingRequestData(db, id))) return null;

  const scope = JSON.stringify(["private-package-history", id]);
  const position = parsePageCursor(input.cursor, positionSchema, scope);
  const rows = await listCustomPackageHistoryData(db, id, {
    limit: input.limit,
    position,
  });

  const page = createPage(rows, input.limit, (row) =>
    encodePageCursor(scope, { createdAt: row.cursor_created_at, id: row.id }),
  );

  return {
    history: page.items.map((row) => {
      const metadata = z
        .object({ before: publicSchema.nullable(), after: publicSchema })
        .parse(row.metadata);

      return {
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        before: metadata.before,
        after: metadata.after,
        createdAt: row.created_at.toISOString(),
      };
    }),
    nextCursor: page.nextCursor,
  };
}
