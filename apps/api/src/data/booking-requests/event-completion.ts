import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function listDueEventCompletionCandidatesData(
  db: Kysely<DB>,
  afterId: string | undefined,
  limit: number,
) {
  const query = db
    .selectFrom("booking_requests")
    .select("id")
    .where("submitted_at", "is not", null)
    .where("status", "=", "accepted")
    .where(
      ({ selectFrom }) =>
        selectFrom("events_day")
          .whereRef("booking_request_id", "=", "booking_requests.id")
          .where("status", "=", "scheduled")
          .select(({ fn }) => fn.max("ends_at").as("last_end")),
      "<",
      sql<Date>`statement_timestamp()`,
    )
    .orderBy("id")
    .limit(limit);

  return (afterId ? query.where("id", ">", afterId) : query).execute();
}

// Recheck the current schedule at database precision after locking the booking.
export async function liveEventDaysHaveEndedData(
  trx: Transaction<DB>,
  id: string,
) {
  const result = await trx
    .selectFrom("events_day")
    .select(
      sql<boolean>`coalesce(max(ends_at) < clock_timestamp(), false)`.as(
        "ended",
      ),
    )
    .where("booking_request_id", "=", id)
    .where("status", "=", "scheduled")
    .executeTakeFirstOrThrow();

  return result.ended;
}
