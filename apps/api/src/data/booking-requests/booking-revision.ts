import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

// pg's Date parser discards microseconds. Keep this opaque revision as SQL text.
export const bookingRevision = sql<string>`to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
export const nextBookingRevision = sql<Date>`greatest(clock_timestamp(), updated_at + interval '1 microsecond')`;
export const touchBookingRevisionData = (db: Transaction<DB>, id: string) =>
  db
    .updateTable("booking_requests")
    .set({ updated_at: nextBookingRevision })
    .where("id", "=", id)
    .execute();
