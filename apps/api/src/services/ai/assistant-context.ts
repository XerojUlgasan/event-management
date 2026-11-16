import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { getBookingRequestService } from "../booking-requests/get-booking-request.js";

export async function buildAssistantContext({
  db,
  customerId,
  bookingRequestId,
}: {
  db: Kysely<DB>;
  customerId: string;
  bookingRequestId: string | null;
}) {
  const booking = bookingRequestId
    ? await getBookingRequestService(db, bookingRequestId, customerId)
    : null;
  if (bookingRequestId && !booking)
    throw new Error("Booking request not found");

  return {
    currentDateTime: new Date().toISOString(),
    timeZone: booking?.timeZone ?? "Asia/Manila",
    bookingRequest: booking
      ? {
          reference: booking.reference,
          status: booking.status,
          eventType: booking.eventType,
          guestCount: booking.guestCount,
          timeZone: booking.timeZone,
          requestedDays:
            booking.requestedDays?.map((day) => ({
              date: day.date,
              startsAt: day.startsAt,
              endsAt: day.endsAt,
              operationalSchedule: day.operationalSchedule
                ? {
                    day: day.operationalSchedule.day,
                    startsAt: day.operationalSchedule.startsAt,
                    endsAt: day.operationalSchedule.endsAt,
                    timeZone: day.operationalSchedule.timeZone,
                    status: day.operationalSchedule.status,
                  }
                : null,
            })) ?? null,
          ...(booking.requestedDays === null
            ? {
                preferredDate: booking.preferredDate,
                startsAt: booking.startsAt,
                endsAt: booking.endsAt,
              }
            : {}),
          preferredVenueLocation: booking.preferredVenueLocation,
          specialRequests: booking.specialRequests,
        }
      : null,
  };
}
