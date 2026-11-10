import { randomUUID } from "node:crypto";
import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, BookingRequests } from "../../db/types.js";
import type { BookingEstimatedDuration } from "@event-management/contracts/limits/booking-requests";
import type { CreateInput, Status } from "../../controllers/booking-requests/schemas.js";
import { findAvailablePackageData, createBookingRequestData, createBookingConversationData, addStatusHistoryData, lockBookingRequestData, updateBookingStatusData, listBookingRequestsData, listAdminBookingRequestsPageData, listBookingRequestDailyCountsData, listStatusHistoryData, findBookingRequestData } from "../../data/booking-requests/booking-requests.js";
import { endDayData, lockScheduledDaysData } from "../../data/event-days/event-days.js";
type Database = Kysely<DB> | Transaction<DB>;
const error = (message: string, status: 400 | 404 | 409) => ({ message, status });
async function response(db: Database, rows: Selectable<BookingRequests>[]) {
  const history = await listStatusHistoryData(db, rows.map(r => r.id));
  return rows.map(r => ({ id:r.id, reference:r.reference, customerId:r.customer_id, packageId:r.package_id, packagePrice:{ kind:"fixed" as const, currency:"PHP" as const, amountMinor:r.package_price * 100 }, packageMaxGuests:r.package_max_guests, packageName:r.package_name, eventType:r.event_type, preferredDate:r.preferred_date, estimatedDuration:r.estimated_duration as BookingEstimatedDuration, estimatedDurationDays:r.estimated_duration_days, startsAt:r.starts_at?.toISOString() ?? null, endsAt:r.ends_at?.toISOString() ?? null, timeZone:r.time_zone, guestCount:r.guest_count, contactName:r.contact_name, phoneNumber:r.phone_number, preferredVenueLocation:r.preferred_venue_location, specialRequests:r.special_requests, status:r.status as Status, outOfRange:r.out_of_range, createdAt:r.created_at.toISOString(), updatedAt:r.updated_at.toISOString(), statusHistory:history.filter(h => h.booking_request_id === r.id).map(h => ({status:h.status as Status, reason:h.reason, changedBy:h.changed_by, createdAt:h.created_at.toISOString()})) }));
}
export async function createBookingRequestService(db: Kysely<DB>, customerId: string, input: CreateInput) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: input.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (input.preferredDate < today) return error("Choose today or a future date", 400);
  return db.transaction().execute(async trx => {
    const pkg = await findAvailablePackageData(trx, input.packageId);
    if (!pkg) return error("Package is no longer available. Refresh and try again", 409);
    if (input.packageUpdatedAt && input.packageUpdatedAt !== pkg.updated_at.toISOString()) return error("Package changed. Refresh and try again", 409);
    const row = await createBookingRequestData(trx, { reference:`BR-${randomUUID().toUpperCase()}`, customer_id:customerId, package_id:input.packageId, package_name:pkg.name, package_price:pkg.price, package_max_guests:pkg.max_guests, event_type:input.eventType, preferred_date:input.preferredDate, estimated_duration:input.estimatedDuration, estimated_duration_days:input.estimatedDurationDays ?? null, starts_at:null, ends_at:null, time_zone:input.timeZone, guest_count:input.guestCount ?? null, contact_name:input.contactName, phone_number:input.phoneNumber, preferred_venue_location:null, special_requests:input.specialRequests || null, status:"under_review", out_of_range:input.guestCount != null && input.guestCount > pkg.max_guests });
    await addStatusHistoryData(trx, row.id, "under_review", customerId, null);
    await createBookingConversationData(trx, { customer_id: customerId, booking_request_id: row.id });
    return (await response(trx, [row]))[0]!;
  });
}
export async function listBookingRequestsService(db: Kysely<DB>, customerId?: string) { return response(db, await listBookingRequestsData(db, customerId)); }
export async function listAdminBookingRequestsPageService(db: Kysely<DB>, input: { status?: Status; preferredDate?: string; cursor?: string; limit: number }) {
  const rows = await listAdminBookingRequestsPageData(db, input);
  const page = rows.slice(0, input.limit);
  return { bookingRequests: await response(db, page), nextCursor: rows.length > input.limit ? page[page.length - 1]!.id : null };
}
export async function listBookingRequestDailyCountsService(db: Kysely<DB>, month: string, status?: Status) {
  return (await listBookingRequestDailyCountsData(db, month, status)).map(row => ({ preferredDate: row.preferred_date, count: Number(row.count) }));
}
async function cancelScheduledEventDays(trx: Transaction<DB>, bookingId: string) {
  const days = await lockScheduledDaysData(trx, bookingId);
  for (const day of days) await endDayData(trx, day.id, "cancelled", null);
}
export async function updateBookingStatusService(db: Kysely<DB>, id: string, actorId: string, status: Status, reason?: string | null) {
  return db.transaction().execute(async trx => {
    const row = await lockBookingRequestData(trx, id);
    if (!row) return error("Booking request not found", 404);
    if (["declined", "cancelled"].includes(row.status) || row.status === status || status === "under_review") return error("Invalid status transition", 409);
    if (status === "cancelled") await cancelScheduledEventDays(trx, id);
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
    await cancelScheduledEventDays(trx, id);
    const updated = await updateBookingStatusData(trx, id, "cancelled");
    await addStatusHistoryData(trx, id, "cancelled", customerId, reason || null);
    return (await response(trx, [updated]))[0]!;
  });
}

export async function getBookingRequestService(db: Kysely<DB>, id: string, customerId?: string) {
  const row = await findBookingRequestData(db, id, customerId);
  return row ? (await response(db, [row]))[0]! : null;
}
