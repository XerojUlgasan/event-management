import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Status } from "../../controllers/booking-requests/schemas.js";
import { listBookingRequestDailyCountsData } from "../../data/booking-requests/list-booking-request-daily-counts.js";

export async function listBookingRequestDailyCountsService(
  db: Kysely<DB>,
  month: string,
  status?: Status,
) {
  return (await listBookingRequestDailyCountsData(db, month, status)).map(
    (row) => ({ preferredDate: row.preferred_date, count: Number(row.count) }),
  );
}
