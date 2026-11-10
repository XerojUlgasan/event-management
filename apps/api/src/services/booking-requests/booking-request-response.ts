import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, BookingRequests } from "../../db/types.js";
import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";
import type { Status } from "../../controllers/booking-requests/schemas.js";
import { listStatusHistoryData } from "../../data/booking-requests/list-status-history.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function bookingRequestDtos(
  db: Database,
  rows: Selectable<BookingRequests>[],
) {
  const history = await listStatusHistoryData(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    customerId: r.customer_id,
    packageId: r.package_id,
    packagePrice: {
      kind: "fixed" as const,
      currency: "PHP" as const,
      amountMinor: r.package_price * 100,
    },
    packageMaxGuests: r.package_max_guests,
    packageName: r.package_name,
    eventType: r.event_type,
    preferredDate: r.preferred_date,
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
    updatedAt: r.updated_at.toISOString(),
    statusHistory: history
      .filter((h) => h.booking_request_id === r.id)
      .map((h) => ({
        status: h.status as Status,
        reason: h.reason,
        changedBy: h.changed_by,
        createdAt: h.created_at.toISOString(),
      })),
  }));
}
