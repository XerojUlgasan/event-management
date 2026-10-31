import { randomUUID } from "node:crypto";
import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, BookingRequests } from "../../db/types.js";
import type { CreateInput, Status } from "../../controllers/booking-requests/schemas.js";
import { findAvailableVersionData, createBookingRequestData, createBookingConversationData, addStatusHistoryData, lockBookingRequestData, updateBookingStatusData, listBookingRequestsData, listStatusHistoryData } from "../../data/booking-requests/booking-requests.js";
type Database = Kysely<DB> | Transaction<DB>;
const error = (message: string, status: 400 | 404 | 409) => ({ message, status });
async function response(db: Database, rows: Selectable<BookingRequests>[]) {
  const history = await listStatusHistoryData(db, rows.map(r => r.id));
  return rows.map(r => ({ id:r.id, reference:r.reference, customerId:r.customer_id, packageId:r.package_id, packageVersionId:r.package_version_id, packageName:r.package_name, eventType:r.event_type, startsAt:r.starts_at.toISOString(), endsAt:r.ends_at.toISOString(), timeZone:r.time_zone, guestCount:r.guest_count, contactName:r.contact_name, phoneNumber:r.phone_number, preferredVenueLocation:r.preferred_venue_location, specialRequests:r.special_requests, status:r.status as Status, outOfRange:r.out_of_range, createdAt:r.created_at.toISOString(), updatedAt:r.updated_at.toISOString(), statusHistory:history.filter(h => h.booking_request_id === r.id).map(h => ({status:h.status as Status, reason:h.reason, changedBy:h.changed_by, createdAt:h.created_at.toISOString()})) }));
}
export async function createBookingRequestService(db: Kysely<DB>, customerId: string, input: CreateInput) {
  const start = new Date(input.startsAt), end = new Date(input.endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) return error("Choose a future start and an end after the start", 400);
  return db.transaction().execute(async trx => {
    const version = await findAvailableVersionData(trx, input.packageId, input.packageVersionId);
    if (!version) return error("Package version is no longer available. Refresh and try again", 409);
    const row = await createBookingRequestData(trx, { reference:`BR-${randomUUID().toUpperCase()}`, customer_id:customerId, package_id:input.packageId, package_version_id:version.id, package_name:version.name, event_type:input.eventType, starts_at:start, ends_at:end, time_zone:input.timeZone, guest_count:input.guestCount, contact_name:input.contactName, phone_number:input.phoneNumber, preferred_venue_location:input.preferredVenueLocation, special_requests:input.specialRequests || null, status:"under_review", out_of_range:input.guestCount < version.guest_min || input.guestCount > version.guest_max });
    await addStatusHistoryData(trx, row.id, "under_review", customerId, null);
    await createBookingConversationData(trx, { customer_id: customerId, booking_request_id: row.id, package_id: row.package_id, event_type: row.event_type, event_starts_at: row.starts_at, event_ends_at: row.ends_at, guest_count: row.guest_count, booking_reference: row.reference, package_name: row.package_name });
    return (await response(trx, [row]))[0]!;
  });
}
export async function listBookingRequestsService(db: Kysely<DB>, customerId?: string) { return response(db, await listBookingRequestsData(db, customerId)); }
export async function updateBookingStatusService(db: Kysely<DB>, id: string, actorId: string, status: Status, reason?: string | null) {
  return db.transaction().execute(async trx => {
    const row = await lockBookingRequestData(trx, id);
    if (!row) return error("Booking request not found", 404);
    if (["declined", "cancelled"].includes(row.status) || row.status === status || status === "under_review") return error("Invalid status transition", 409);
    const updated = await updateBookingStatusData(trx, id, status);
    await addStatusHistoryData(trx, id, status, actorId, reason || null);
    return (await response(trx, [updated]))[0]!;
  });
}

export async function cancelBookingRequestService(db: Kysely<DB>, id: string, customerId: string, reason: string) {
  return db.transaction().execute(async trx => {
    const row = await lockBookingRequestData(trx, id);
    if (!row || row.customer_id !== customerId) return error("Booking request not found", 404);
    if (!["under_review", "needs_details", "accepted"].includes(row.status)) return error("Invalid status transition", 409);
    const updated = await updateBookingStatusData(trx, id, "cancelled");
    await addStatusHistoryData(trx, id, "cancelled", customerId, reason || null);
    return (await response(trx, [updated]))[0]!;
  });
}
