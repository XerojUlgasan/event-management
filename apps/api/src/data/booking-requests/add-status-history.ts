import type { Transaction } from "kysely";
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
    })
    .returning("id")
    .executeTakeFirstOrThrow();
