import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, BookingRequests } from "../../db/types.js";
import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";
import type { Status } from "../../controllers/booking-requests/schemas.js";
import { requestedDaysSchema } from "../../controllers/booking-requests/schemas.js";
import { listRequestedDaySchedulesData } from "../../data/booking-requests/list-requested-day-schedules.js";
import { listBookingPackagesData } from "../../data/booking-requests/list-booking-packages.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function bookingRequestDtos(
  db: Database,
  rows: (Selectable<BookingRequests> & { revision: string })[],
) {
  const packages = new Map(
    (
      await listBookingPackagesData(db, [
        ...new Set(rows.flatMap((r) => (r.package_id ? [r.package_id] : []))),
      ])
    ).map((pkg) => [pkg.id, pkg]),
  );
  const schedules = new Map(
    (
      await listRequestedDaySchedulesData(
        db,
        rows.map((r) => r.id),
      )
    ).map((day) => [day.id, day]),
  );
  return rows.map((r) => {
    const pkg = r.package_id ? packages.get(r.package_id) : undefined;
    if (r.package_id && !pkg)
      throw new Error("Booking request package not found");
    const days =
      r.requested_days === null
        ? null
        : requestedDaysSchema.parse(r.requested_days);
    return {
      id: r.id,
      reference: r.reference,
      customerId: r.customer_id,
      packageId: r.package_id,
      packagePrice: pkg
        ? {
            kind: "fixed" as const,
            currency: "PHP" as const,
            amountMinor: pkg.price * 100,
          }
        : null,
      packageMaxGuests: pkg?.max_guests ?? null,
      packageName: pkg?.name ?? null,
      eventType: r.event_type,
      preferredDate: r.preferred_date,
      requestedDays:
        days?.map((day) => {
          let schedule = day.eventDayId
            ? schedules.get(day.eventDayId)
            : undefined;
          const visited = new Set<string>();
          while (
            schedule?.replacement_event_day_id &&
            !visited.has(schedule.id)
          ) {
            visited.add(schedule.id);
            const replacement = schedules.get(
              schedule.replacement_event_day_id,
            );
            if (!replacement || replacement.booking_request_id !== r.id) break;
            schedule = replacement;
          }
          return {
            ...day,
            operationalSchedule:
              schedule && schedule.booking_request_id === r.id
                ? {
                    id: schedule.id,
                    day: schedule.day,
                    startsAt: schedule.starts_at.toISOString(),
                    endsAt: schedule.ends_at.toISOString(),
                    timeZone: r.time_zone,
                    status: schedule.status,
                  }
                : null,
          };
        }) ?? null,
      durationMode:
        days === null
          ? null
          : days.length === 1
            ? ("one_day" as const)
            : ("multi_day" as const),
      requestedDayCount: days?.length ?? null,
      estimatedDuration: r.estimated_duration as BookingEstimatedDuration,
      estimatedDurationDays: r.estimated_duration_days,
      startsAt: r.starts_at?.toISOString() ?? null,
      endsAt: r.ends_at?.toISOString() ?? null,
      timeZone: r.time_zone,
      guestCount: r.guest_count,
      contactName: r.contact_name,
      phoneNumber: r.phone_number,
      preferredVenueLocation: r.preferred_venue_location,
      specialRequests: r.special_requests,
      status: r.status as Status,
      outOfRange: r.out_of_range,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.revision,
    };
  });
}
