import { sql } from "kysely";
import type { SeedDb } from "../context.js";
import { expectCount } from "../context.js";
import type { ScenarioBooking, ScenarioEventDay } from "./activity.js";

export async function seedScenarioOperations(
  db: SeedDb,
  input: { bookings: ScenarioBooking[]; now: Date },
) {
  const days = input.bookings.flatMap((booking) => booking.eventDays);

  expectCount("event days", days.length);

  const acceptedIds = new Set(
    input.bookings
      .filter((booking) => booking.status === "accepted")
      .map((booking) => booking.id),
  );

  if (days.some((day) => !acceptedIds.has(day.bookingId)))
    throw new Error(
      "Operational days belong only on accepted booking requests",
    );

  let eventDays = 0;

  const ordered: ScenarioEventDay[] = [
    ...days.filter((day) => day.status !== "moved"),
    ...days.filter((day) => day.status === "moved"),
  ];

  for (const day of ordered) {
    const inserted = await db
      .insertInto("events_day")
      .values({
        id: day.id,
        booking_request_id: day.bookingId,
        day: sql`${day.day}::date`,
        starts_at: day.startsAt,
        ends_at: day.endsAt,
        status: day.status,
        replacement_event_day_id: day.replacementEventDayId,
        created_at: input.now,
        updated_at: input.now,
      })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .returning("id")
      .executeTakeFirst();

    if (inserted) eventDays += 1;
  }

  return { inserted: { eventDays } };
}
