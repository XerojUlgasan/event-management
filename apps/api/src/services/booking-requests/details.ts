import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { UpdateDetailsInput } from "../../controllers/booking-requests/schemas.js";
import { lockBookingRequestData, findLinkedPackageData, updateBookingDetailsData } from "../../data/booking-requests/booking-requests.js";
import { createAuditEventData } from "../../data/audit/audit-events.js";
import { bookingResponse } from "./response.js";

const error = (message: string, status: 400 | 404 | 409) => ({
  message,
  status,
});

export async function updateDetailsService(
  db: Kysely<DB>,
  bookingId: string,
  actorId: string,
  input: UpdateDetailsInput,
) {
  return db.transaction().execute(async (trx) => {
    const booking = await lockBookingRequestData(trx, bookingId);
    if (!booking) return error("Booking request not found", 404);
    if (["declined", "cancelled"].includes(booking.status))
      return error("This request is closed and cannot be edited", 409);

    const current = booking;
    if (input.expectedUpdatedAt !== current.updated_at.toISOString())
      return error("The booking request changed. Refresh and try again", 409);

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

    const pkg = await findLinkedPackageData(trx, booking.package_id);
    const updated = await updateBookingDetailsData(trx, bookingId, {
      ...next,
      out_of_range: next.guest_count != null && next.guest_count > pkg.max_guests,
      updated_by: actorId,
      updated_at: new Date(Math.max(Date.now(), current.updated_at.getTime() + 1)),
    });
    await createAuditEventData(trx, {
      actor_id: actorId,
      action: "booking_request.details_updated",
      entity_type: "booking_request",
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

    return (await bookingResponse(trx, [updated], true))[0]!;
  });
}
