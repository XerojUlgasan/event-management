import type { Kysely, Selectable, Transaction } from "kysely";
import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";
import type { DB, BookingRequests } from "../../db/types.js";
import type { Status } from "../../controllers/booking-requests/schemas.js";
import { listStatusHistoryData, listBookingPackagesData, listBookingEditorsData } from "../../data/booking-requests/booking-requests.js";
import { listPackageServicesData } from "../../data/packages/package-services.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function bookingResponse(db: Database, rows: Selectable<BookingRequests>[], admin = false, restrictPrivatePackages = false) {
  if (!rows.length) return [];
  const packageIds = [...new Set(rows.map(row => row.package_id))];
  const userIds = [...new Set(rows.flatMap(row => row.updated_by ? [row.updated_by] : []))];
  const [history, packages, inclusions, users] = await Promise.all([
    listStatusHistoryData(db, rows.map(row => row.id)),
    listBookingPackagesData(db, packageIds),
    listPackageServicesData(db, packageIds),
    listBookingEditorsData(db, userIds),
  ]);
  return rows.map(row => {
    const pkg = packages.find(item => item.id === row.package_id);
    if (!pkg) throw new Error("Linked booking package not found");
    const restricted = restrictPrivatePackages && pkg.package_type === "custom";
    const user = users.find(item => item.id === row.updated_by);
    return {
      id: row.id, reference: row.reference, customerId: row.customer_id, packageId: row.package_id,
      packageType: pkg.package_type as "catalog" | "custom", packageUpdatedAt: restricted ? row.updated_at.toISOString() : pkg.updated_at.toISOString(),
      packagePrice: restricted ? null : { kind: "fixed" as const, currency: "PHP" as const, amountMinor: pkg.price * 100 },
      packageMaxGuests: restricted ? null : pkg.max_guests, packageName: restricted ? "Private custom package" : pkg.name,
      eventType: row.event_type, preferredDate: row.preferred_date,
      estimatedDuration: row.estimated_duration as BookingEstimatedDuration, estimatedDurationDays: row.estimated_duration_days,
      startsAt: row.starts_at?.toISOString() ?? null, endsAt: row.ends_at?.toISOString() ?? null,
      guestCount: row.guest_count, contactName: row.contact_name, phoneNumber: row.phone_number,
      preferredVenueLocation: row.preferred_venue_location,
      packageInclusions: inclusions.filter(item => !restricted && item.package_id === row.package_id).map(item => ({ serviceId: item.service_id, name: item.name, role: item.role as "included" | "optional", sortOrder: item.sort_order })),
      specialRequests: row.special_requests, status: row.status as Status,
      outOfRange: !restricted && row.guest_count != null && row.guest_count > pkg.max_guests,
      notes: admin ? row.notes : null, updatedBy: row.updated_by, updatedByName: user ? user.display_name ?? user.email : null,
      createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
      statusHistory: history.filter(entry => entry.booking_request_id === row.id).map(entry => ({ status: entry.status as Status, reason: entry.reason, changedBy: entry.changed_by, createdAt: entry.created_at.toISOString() })),
    };
  });
}
