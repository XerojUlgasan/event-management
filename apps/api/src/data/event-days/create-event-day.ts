import { sql } from "kysely";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export async function createEventDayData(
  db: Transaction<DB>,
  bookingId: string,
  input: {
    day: string;
    startsAt: string;
    endsAt: string;
    staffingStatus: string;
    availabilityDeadline: string | null;
  },
) {
  const row = await db
    .insertInto("events_day")
    .values({
      booking_request_id: bookingId,
      day: sql`${input.day}::date`,
      starts_at: new Date(input.startsAt),
      ends_at: new Date(input.endsAt),
      staffing_status: input.staffingStatus,
      availability_deadline: input.availabilityDeadline
        ? new Date(input.availabilityDeadline)
        : null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
