import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { CreateInput, Status } from "../../controllers/booking-requests/schemas.js";
import { findAvailablePackageData, createBookingRequestData, createBookingConversationData, addStatusHistoryData, lockBookingRequestData, updateBookingStatusData, listBookingRequestsData, listAdminBookingRequestsPageData, listBookingRequestDailyCountsData, findBookingRequestData } from "../../data/booking-requests/booking-requests.js";
import { bookingResponse } from "./response.js";
const error = (message: string, status: 400 | 404 | 409) => ({ message, status });

export async function createBookingRequestService(db: Kysely<DB>, customerId: string, input: CreateInput) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (input.preferredDate < today) return error("Choose today or a future date", 400);
  return db.transaction().execute(async trx => {
    const pkg = await findAvailablePackageData(trx, input.packageId);
    if (!pkg) return error("Package is no longer available. Refresh and try again", 409);
    if (input.packageUpdatedAt && input.packageUpdatedAt !== pkg.updated_at.toISOString()) return error("Package changed. Refresh and try again", 409);
    const row = await createBookingRequestData(trx, { reference:`BR-${randomUUID().toUpperCase()}`, customer_id:customerId, package_id:input.packageId, event_type:input.eventType, preferred_date:input.preferredDate, estimated_duration:input.estimatedDuration, estimated_duration_days:input.estimatedDurationDays ?? null, starts_at:null, ends_at:null, guest_count:input.guestCount ?? null, contact_name:input.contactName, phone_number:input.phoneNumber, preferred_venue_location:input.preferredVenueLocation || null, special_requests:input.specialRequests || null, status:"under_review", out_of_range:input.guestCount != null && input.guestCount > pkg.max_guests });
    await addStatusHistoryData(trx, row.id, "under_review", customerId, null);
    await createBookingConversationData(trx, { customer_id: customerId, booking_request_id: row.id });
    return (await bookingResponse(trx, [row]))[0]!;
  });
}

export async function listBookingRequestsService(db: Kysely<DB>, customerId?: string, admin = false) {
  return bookingResponse(db, await listBookingRequestsData(db, customerId), admin, !customerId && !admin);
}

export async function listAdminBookingRequestsPageService(db: Kysely<DB>, input: { status?: Status; preferredDate?: string; cursor?: string; limit: number }, admin = false) {
  const rows = await listAdminBookingRequestsPageData(db, input);
  const page = rows.slice(0, input.limit);
  return { bookingRequests: await bookingResponse(db, page, admin, !admin), nextCursor: rows.length > input.limit ? page[page.length - 1]!.id : null };
}

export async function listBookingRequestDailyCountsService(db: Kysely<DB>, month: string, status?: Status) {
  return (await listBookingRequestDailyCountsData(db, month, status)).map(row => ({ preferredDate: row.preferred_date, count: Number(row.count) }));
}

export async function updateBookingStatusService(db: Kysely<DB>, id: string, actorId: string, status: Status, reason?: string | null) {
  return db.transaction().execute(async trx => {
    const row = await lockBookingRequestData(trx, id);
    if (!row) return error("Booking request not found", 404);
    if (["declined", "cancelled"].includes(row.status) || row.status === status || status === "under_review") return error("Invalid status transition", 409);
    const updated = await updateBookingStatusData(trx, id, status, row.updated_at);
    await addStatusHistoryData(trx, id, status, actorId, reason || null);
    return (await bookingResponse(trx, [updated], true))[0]!;
  });
}

export async function cancelBookingRequestService(db: Kysely<DB>, id: string, customerId: string, reason: string) {
  return db.transaction().execute(async trx => {
    const row = await lockBookingRequestData(trx, id);
    if (!row || row.customer_id !== customerId) return error("Booking request not found", 404);
    if (!["under_review", "needs_details", "accepted"].includes(row.status)) return error("Invalid status transition", 409);
    const updated = await updateBookingStatusData(trx, id, "cancelled", row.updated_at);
    await addStatusHistoryData(trx, id, "cancelled", customerId, reason || null);
    return (await bookingResponse(trx, [updated]))[0]!;
  });
}

export async function getBookingRequestService(db: Kysely<DB>, id: string, customerId?: string, admin = false) {
  const row = await findBookingRequestData(db, id, customerId);
  return row ? (await bookingResponse(db, [row], admin, !customerId && !admin))[0]! : null;
}
