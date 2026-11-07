import type { Kysely, Selectable, Transaction } from "kysely";
import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";
import type { DB, BookingRequests } from "../../db/types.js";
import { packageInclusionSnapshotSchema, type Status } from "../../controllers/booking-requests/schemas.js";
import type { ArrangementRow } from "../../data/booking-requests/arrangements.js";
import type { CustomizationRequestRow } from "../../data/customization-requests/customization-requests.js";
import { listStatusHistoryData } from "../../data/booking-requests/booking-requests.js";
import { listArrangementsData } from "../../data/booking-requests/arrangements.js";
import { listCustomizationRequestsByBookingIdsData } from "../../data/customization-requests/customization-requests.js";
import { customizationRequestDto } from "../customization-requests/response.js";

type Database = Kysely<DB> | Transaction<DB>;

const displayName = (name: string | null, email: string) => name ?? email;
const readInclusionSnapshot = (value: BookingRequests["package_inclusions_snapshot"]) =>
  value === null
    ? null
    : (packageInclusionSnapshotSchema.safeParse(value).data ?? null);

export function arrangementDto(row: ArrangementRow, packageMaxGuests: number) {
  return {
    id: row.id,
    bookingRequestId: row.booking_request_id,
    eventType: row.event_type,
    preferredDate: row.preferred_date,
    estimatedDuration: row.estimated_duration as BookingEstimatedDuration,
    estimatedDurationDays: row.estimated_duration_days,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    timeZone: row.time_zone,
    guestCount: row.guest_count,
    preferredVenueLocation: row.preferred_venue_location,
    notes: row.notes,
    updatedBy: row.updated_by,
    updatedByName: displayName(row.updated_by_name, "Clemora team"),
    outOfRange: row.guest_count != null && row.guest_count > packageMaxGuests,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function bookingResponse(
  db: Database,
  rows: Selectable<BookingRequests>[],
) {
  const ids = rows.map((row) => row.id);
  const [history, arrangements, customizationRequests] = await Promise.all([
    listStatusHistoryData(db, ids),
    listArrangementsData(db, ids),
    listCustomizationRequestsByBookingIdsData(db, ids),
  ]);
  const arrangementByBooking = new Map(
    arrangements.map((row) => [row.booking_request_id, row]),
  );
  const customizationByBooking = new Map<string, CustomizationRequestRow[]>();
  for (const request of customizationRequests) {
    const list = customizationByBooking.get(request.booking_request_id) ?? [];
    list.push(request);
    customizationByBooking.set(request.booking_request_id, list);
  }
  return rows.map((row) => {
    const arrangement = arrangementByBooking.get(row.id);
    const requests = customizationByBooking.get(row.id) ?? [];
    return {
      id: row.id,
      reference: row.reference,
      customerId: row.customer_id,
      packageId: row.package_id,
      packagePrice: {
        kind: "fixed" as const,
        currency: "PHP" as const,
        amountMinor: row.package_price * 100,
      },
      packageMaxGuests: row.package_max_guests,
      packageName: row.package_name,
      eventType: row.event_type,
      preferredDate: row.preferred_date,
      estimatedDuration: row.estimated_duration as BookingEstimatedDuration,
      estimatedDurationDays: row.estimated_duration_days,
      startsAt: row.starts_at?.toISOString() ?? null,
      endsAt: row.ends_at?.toISOString() ?? null,
      timeZone: row.time_zone,
      guestCount: row.guest_count,
      contactName: row.contact_name,
      phoneNumber: row.phone_number,
      preferredVenueLocation: row.preferred_venue_location,
      packageInclusionsSnapshot: readInclusionSnapshot(
        row.package_inclusions_snapshot,
      ),
      specialRequests: row.special_requests,
      status: row.status as Status,
      outOfRange: row.out_of_range,
      arrangement: arrangement
        ? arrangementDto(arrangement, row.package_max_guests)
        : null,
      customizationRequests: requests.map(customizationRequestDto),
      pendingCustomizationRequests: requests.filter(
        (request) => request.status === "requested",
      ).length,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      statusHistory: history
        .filter((entry) => entry.booking_request_id === row.id)
        .map((entry) => ({
          status: entry.status as Status,
          reason: entry.reason,
          changedBy: entry.changed_by,
          createdAt: entry.created_at.toISOString(),
        })),
    };
  });
}
