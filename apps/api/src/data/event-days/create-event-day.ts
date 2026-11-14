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
  },
) {
  const row = await db
    .insertInto("events_day")
    .values({
      booking_request_id: bookingId,
      day: sql`${input.day}::date`,
      starts_at: new Date(input.startsAt),
      ends_at: new Date(input.endsAt),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
