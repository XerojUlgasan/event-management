import { sql } from "kysely";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function endEventDayData(
  db: Transaction<DB>,
  id: string,
  status: "cancelled" | "moved",
  replacementId: string | null,
) {
  await sql`update events_day set status=${status},replacement_event_day_id=${replacementId}::uuid,updated_at=now() where id=${id}::uuid`.execute(
    db,
  );
}
