import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { UpdateArrangementInput } from "../../controllers/booking-requests/schemas.js";
import { lockBookingRequestData } from "../../data/booking-requests/booking-requests.js";
import {
  createArrangementData,
  findArrangementForUpdateData,
  updateArrangementData,
} from "../../data/booking-requests/arrangements.js";
import { createAuditEventData } from "../../data/audit/audit-events.js";
import { bookingResponse } from "./response.js";

const error = (message: string, status: 400 | 404 | 409) => ({
  message,
  status,
});

export async function updateArrangementService(
  db: Kysely<DB>,
  bookingId: string,
  actorId: string,
  input: UpdateArrangementInput,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, bookingId);
    if (!booking) return error("Booking request not found", 404);
    if (["declined", "cancelled"].includes(booking.status))
      return error("This request is closed and cannot be edited", 409);

    let current = await findArrangementForUpdateData(trx, bookingId);
    if (!current) {
      current = await createArrangementData(trx, {
        booking_request_id: bookingId,
        event_type: booking.event_type,
        preferred_date: booking.preferred_date,
        estimated_duration: booking.estimated_duration,
        estimated_duration_days: booking.estimated_duration_days,
        starts_at: booking.starts_at,
        ends_at: booking.ends_at,
        time_zone: booking.time_zone,
        guest_count: booking.guest_count,
        preferred_venue_location: booking.preferred_venue_location,
        notes: null,
        updated_by: actorId,
      });
    }

    if (
      input.expectedUpdatedAt &&
      input.expectedUpdatedAt !== current.updated_at.toISOString()
    )
      return error("The arrangement changed. Refresh and try again", 409);

    const next = {
      event_type: input.eventType ?? current.event_type,
      preferred_date: input.preferredDate ?? current.preferred_date,
      estimated_duration:
        input.estimatedDuration ?? current.estimated_duration,
      estimated_duration_days:
        input.estimatedDurationDays === undefined
          ? current.estimated_duration_days
          : input.estimatedDurationDays,
      starts_at:
        input.startsAt === undefined
          ? current.starts_at
          : input.startsAt
            ? new Date(input.startsAt)
            : null,
      ends_at:
        input.endsAt === undefined
          ? current.ends_at
          : input.endsAt
            ? new Date(input.endsAt)
            : null,
      time_zone: input.timeZone ?? current.time_zone,
      guest_count:
        input.guestCount === undefined
          ? current.guest_count
          : input.guestCount,
      preferred_venue_location:
        input.preferredVenueLocation === undefined
          ? current.preferred_venue_location
          : input.preferredVenueLocation || null,
      notes:
        input.notes === undefined ? current.notes : input.notes || null,
    };

    if (
      next.estimated_duration === "more_than_1_week" &&
      next.estimated_duration_days == null
    )
      return error("Enter the event length in days", 400);
    if (
      next.estimated_duration !== "more_than_1_week" &&
      next.estimated_duration_days != null
    )
      return error(
        "Exact days are only allowed for more than 1 week",
        400,
      );
    if (next.starts_at && next.ends_at && next.ends_at <= next.starts_at)
      return error("End time must be after the start time", 400);

    await updateArrangementData(trx, bookingId, {
      ...next,
      updated_by: actorId,
      updated_at: new Date(),
    });
    await createAuditEventData(trx, {
      actor_id: actorId,
      action: "arrangement.updated",
      entity_type: "booking_arrangement",
      entity_id: bookingId,
      metadata: JSON.stringify({
        before: {
          eventType: current.event_type,
          preferredDate: current.preferred_date,
          estimatedDuration: current.estimated_duration,
          estimatedDurationDays: current.estimated_duration_days,
          startsAt: current.starts_at?.toISOString() ?? null,
          endsAt: current.ends_at?.toISOString() ?? null,
          guestCount: current.guest_count,
          preferredVenueLocation: current.preferred_venue_location,
          notes: current.notes,
        },
        after: {
          eventType: next.event_type,
          preferredDate: next.preferred_date,
          estimatedDuration: next.estimated_duration,
          estimatedDurationDays: next.estimated_duration_days,
          startsAt: next.starts_at?.toISOString() ?? null,
          endsAt: next.ends_at?.toISOString() ?? null,
          guestCount: next.guest_count,
          preferredVenueLocation: next.preferred_venue_location,
          notes: next.notes,
        },
      }),
    });

    return (await bookingResponse(trx, [booking]))[0]!;
  });
}
