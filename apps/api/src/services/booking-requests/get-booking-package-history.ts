import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { publicSchema } from "../../controllers/packages/schemas.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { listCustomPackageHistoryData } from "../../data/booking-requests/list-custom-package-history.js";

export async function getBookingPackageHistoryService(db: Kysely<DB>, id: string) {
  if (!(await findBookingRequestData(db, id))) return null;
  const rows = await listCustomPackageHistoryData(db, id);
  return rows.map(row => {
    const metadata = z.object({ before: publicSchema, after: publicSchema }).parse(row.metadata);
    return { id: row.id, actorId: row.actor_id, action: row.action, before: metadata.before, after: metadata.after, createdAt: row.created_at.toISOString() };
  });
}
