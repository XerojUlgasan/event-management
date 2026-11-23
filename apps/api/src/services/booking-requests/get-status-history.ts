import { createPage } from "@event-management/contracts/pagination";
import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { listStatusHistoryData } from "../../data/booking-requests/list-status-history.js";
import {
  encodePageCursor,
  parsePageCursor,
  postgresTimestampSchema,
} from "../../utils/pagination.js";
import type { Status } from "../../controllers/booking-requests/schemas.js";

const positionSchema = z.object({
  createdAt: postgresTimestampSchema.refine((value) =>
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value),
  ),
  id: z.string().uuid(),
});

export async function getStatusHistoryService(
  db: Kysely<DB>,
  id: string,
  input: { limit: number; cursor?: string },
  customerId?: string,
) {
  if (!(await findBookingRequestData(db, id, customerId))) return null;

  const scope = JSON.stringify([
    "booking-status-history",
    id,
    customerId ?? null,
  ]);
  const position = parsePageCursor(input.cursor, positionSchema, scope);
  const rows = await listStatusHistoryData(db, id, {
    limit: input.limit,
    position,
  });

  const page = createPage(rows, input.limit, (row) =>
    encodePageCursor(scope, { createdAt: row.cursor_created_at, id: row.id }),
  );

  return {
    history: page.items.map((row) => ({
      id: row.id,
      status: row.status as Status,
      reason: row.reason,
      changedBy: row.changed_by,
      createdAt: row.created_at.toISOString(),
    })),
    nextCursor: page.nextCursor,
  };
}
