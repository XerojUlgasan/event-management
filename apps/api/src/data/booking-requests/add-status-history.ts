import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const addStatusHistoryData = (
  db: Transaction<DB>,
  bookingRequestId: string,
  status: string,
  changedBy: string,
  reason: string | null,
) =>
  db
    .insertInto("booking_request_status_history")
    .values({
      booking_request_id: bookingRequestId,
      status,
      changed_by: changedBy,
      reason,
      // Record the change after acquiring the booking lock, even if the transaction waited.
      created_at: sql<Date>`clock_timestamp()`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
