import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { bookingRevision, nextBookingRevision } from "./booking-revision.js";

export function listDueEventCompletionCandidatesData(
  db: Kysely<DB>,
  afterId: string | undefined,
  limit: number,
) {
  const query = db
    .selectFrom("booking_requests")
    .select("id")
    .where("submitted_at", "is not", null)
    .where("event_ready_at", "is", null)
    .where("event_finished_at", "is", null)
    .where("status", "not in", ["declined", "cancelled"])
    .where(
      ({ selectFrom }) =>
        selectFrom("events_day")
          .whereRef("booking_request_id", "=", "booking_requests.id")
          .where("status", "=", "scheduled")
          .select(({ fn }) => fn.max("ends_at").as("last_end")),
      "<=",
      sql<Date>`statement_timestamp()`,
    )
    .orderBy("id")
    .limit(limit);

  return (afterId ? query.where("id", ">", afterId) : query).execute();
}

// Evaluate the inclusive boundary at database precision, after the booking lock.
export async function liveEventDaysHaveEndedData(
  trx: Transaction<DB>,
  id: string,
) {
  const result = await trx
    .selectFrom("events_day")
    .select(
      sql<boolean>`coalesce(max(ends_at) <= clock_timestamp(), false)`.as(
        "ended",
      ),
    )
    .where("booking_request_id", "=", id)
    .where("status", "=", "scheduled")
    .executeTakeFirstOrThrow();

  return result.ended;
}

export const markEventReadyData = (trx: Transaction<DB>, id: string) =>
  trx
    .updateTable("booking_requests")
    .set({ event_ready_at: sql<Date>`clock_timestamp()` })
    .where("id", "=", id)
    .execute();

export const clearEventReadinessData = (trx: Transaction<DB>, id: string) =>
  trx
    .updateTable("booking_requests")
    .set({ event_ready_at: null })
    .where("id", "=", id)
    .where("event_ready_at", "is not", null)
    .where("event_finished_at", "is", null)
    .execute();

export const touchEventScheduleRevisionData = (
  trx: Transaction<DB>,
  id: string,
) =>
  trx
    .updateTable("booking_requests")
    .set({ event_ready_at: null, updated_at: nextBookingRevision })
    .where("id", "=", id)
    .execute();

export const markEventFinishedData = (
  trx: Transaction<DB>,
  id: string,
  adminId: string,
) =>
  trx
    .updateTable("booking_requests")
    .set({
      event_finished_at: sql<Date>`clock_timestamp()`,
      event_finished_by: adminId,
    })
    .where("id", "=", id)
    .returningAll()
    .returning(bookingRevision.as("revision"))
    .executeTakeFirstOrThrow();
