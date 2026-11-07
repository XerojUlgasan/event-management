import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { QuotationItemInput, QuotationStatus } from "../../controllers/quotations/schemas.js";
import { createAuditEventData } from "../../data/audit/audit-events.js";
import { lockBookingRequestData } from "../../data/booking-requests/booking-requests.js";
import { createQuotationData, findBookingData, findBookingForQuotationData, findQuotationData, listQuotationItemsData, listQuotationsData, lockQuotationData, nextQuotationVersionData, replaceQuotationItemsData, updateQuotationData } from "../../data/quotations/quotations.js";

const error = (message: string, status: 400 | 403 | 404 | 409) => ({ message, status });
const total = (baseAmountMinor: number, items: QuotationItemInput[]) => baseAmountMinor + items.reduce((sum, item) => sum + (item.direction === "add" ? item.amountMinor : -item.amountMinor), 0);
const itemRows = (quotationId: string, items: QuotationItemInput[]) => items.map((item, index) => ({ quotation_id: quotationId, direction: item.direction, kind: item.kind, description: item.description, amount_minor: item.amountMinor, service_id: item.serviceId ?? null, customization_request_id: item.customizationRequestId ?? null, sort_order: index }));

async function quotationDto(db: Kysely<DB>, row: { id: string; booking_request_id: string; version: number; currency: string; base_amount_minor: number; total_amount_minor: number; status: string; created_by: string; created_at: Date; updated_at: Date; sent_at: Date | null; accepted_at: Date | null; superseded_at: Date | null }) {
  const items = await listQuotationItemsData(db, [row.id]);
  return { id: String(row.id), bookingRequestId: row.booking_request_id, version: row.version, currency: "PHP" as const, baseAmountMinor: row.base_amount_minor, totalAmountMinor: row.total_amount_minor, status: row.status as QuotationStatus, createdBy: row.created_by, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), sentAt: row.sent_at?.toISOString() ?? null, acceptedAt: row.accepted_at?.toISOString() ?? null, supersededAt: row.superseded_at?.toISOString() ?? null, items: items.map(item => ({ id: String(item.id), direction: item.direction as "add" | "deduct", kind: item.kind as "addition" | "deduction" | "substitution" | "adjustment", description: item.description, amountMinor: item.amount_minor, serviceId: item.service_id, customizationRequestId: item.customization_request_id, sortOrder: item.sort_order })) };
}

export async function listQuotationsService(db: Kysely<DB>, bookingId: string, actorId: string, customer: boolean) {
  const booking = await findBookingData(db, bookingId);
  if (!booking) return error("Booking request not found", 404);
  if (customer && booking.customer_id !== actorId) return error("Booking request not found", 404);
  const rows = await listQuotationsData(db, bookingId);
  return Promise.all(rows.map(row => quotationDto(db, row)));
}

export async function createQuotationService(db: Kysely<DB>, bookingId: string, actorId: string) {
  return db.transaction().execute(async trx => {
    const booking = await lockBookingRequestData(trx, bookingId);
    if (!booking) return error("Booking request not found", 404);
    if (["declined", "cancelled"].includes(booking.status)) return error("This request is closed", 409);
    const version = await nextQuotationVersionData(trx, bookingId);
    const row = await createQuotationData(trx, { booking_request_id: bookingId, version, currency: "PHP", base_amount_minor: booking.package_price * 100, total_amount_minor: booking.package_price * 100, status: "draft", created_by: actorId });
    await createAuditEventData(trx, { actor_id: actorId, action: "quotation.created", entity_type: "quotation", entity_id: row.id, metadata: JSON.stringify({ bookingRequestId: bookingId, version }) });
    return quotationDto(trx, row);
  });
}

export async function updateQuotationService(db: Kysely<DB>, id: string, actorId: string, items: QuotationItemInput[], expectedUpdatedAt?: string) {
  return db.transaction().execute(async trx => {
    const row = await lockQuotationData(trx, id);
    if (!row) return error("Quotation not found", 404);
    if (row.created_by !== actorId) return error("Quotation not found", 404);
    const booking = await lockBookingRequestData(trx, row.booking_request_id);
    if (!booking) return error("Booking request not found", 404);
    if (row.status !== "draft") return error("Only draft quotations can be edited", 409);
    if (expectedUpdatedAt && expectedUpdatedAt !== row.updated_at.toISOString()) return error("Quotation changed. Refresh and try again", 409);
    const updated = await updateQuotationData(trx, id, { total_amount_minor: total(row.base_amount_minor, items), updated_at: new Date() });
    await replaceQuotationItemsData(trx, id, itemRows(id, items));
    await createAuditEventData(trx, { actor_id: actorId, action: "quotation.updated", entity_type: "quotation", entity_id: id, metadata: JSON.stringify({ itemCount: items.length }) });
    return quotationDto(trx, updated);
  });
}

export async function sendQuotationService(db: Kysely<DB>, id: string, actorId: string) {
  return db.transaction().execute(async trx => {
    const row = await lockQuotationData(trx, id);
    if (!row) return error("Quotation not found", 404);
    if (row.created_by !== actorId) return error("Quotation not found", 404);
    const booking = await lockBookingRequestData(trx, row.booking_request_id);
    if (!booking) return error("Booking request not found", 404);
    if (row.status !== "draft") return error("Only draft quotations can be sent", 409);
    const items = await listQuotationItemsData(trx, [id]);
    if (!items.length) return error("Add at least one quotation item before sending", 400);
    if (row.total_amount_minor < 0) return error("Quotation total cannot be negative", 400);
    const sentAt = new Date();
    await trx.updateTable("quotations").set({ status: "superseded", superseded_at: sentAt, updated_at: sentAt }).where("booking_request_id", "=", row.booking_request_id).where("status", "=", "sent").execute();
    const updated = await updateQuotationData(trx, id, { status: "sent", sent_at: sentAt, updated_at: sentAt });
    await createAuditEventData(trx, { actor_id: actorId, action: "quotation.sent", entity_type: "quotation", entity_id: id, metadata: JSON.stringify({ version: row.version }) });
    return quotationDto(trx, updated);
  });
}

export async function acceptQuotationService(db: Kysely<DB>, id: string, customerId: string) {
  return db.transaction().execute(async trx => {
    const row = await lockQuotationData(trx, id);
    if (!row) return error("Quotation not found", 404);
    const booking = await findBookingForQuotationData(trx, id);
    if (!booking || booking.customer_id !== customerId) return error("Quotation not found", 404);
    const lockedBooking = await lockBookingRequestData(trx, row.booking_request_id);
    if (!lockedBooking) return error("Booking request not found", 404);
    if (row.status !== "sent") return error("Only the latest sent quotation can be accepted", 409);
    const active = await trx.selectFrom("quotations").select("id").where("booking_request_id", "=", row.booking_request_id).where("status", "=", "sent").executeTakeFirst();
    if (!active || active.id !== id) return error("Only the latest sent quotation can be accepted", 409);
    const updated = await updateQuotationData(trx, id, { status: "accepted", accepted_at: new Date(), updated_at: new Date() });
    await createAuditEventData(trx, { actor_id: customerId, action: "quotation.accepted", entity_type: "quotation", entity_id: id, metadata: JSON.stringify({ bookingRequestId: row.booking_request_id }) });
    return quotationDto(trx, updated);
  });
}

export async function requestQuotationRevisionService(db: Kysely<DB>, id: string, customerId: string, reason: string) {
  return db.transaction().execute(async trx => {
    const row = await lockQuotationData(trx, id);
    if (!row) return error("Quotation not found", 404);
    const booking = await findBookingForQuotationData(trx, id);
    if (!booking || booking.customer_id !== customerId) return error("Quotation not found", 404);
    const lockedBooking = await lockBookingRequestData(trx, row.booking_request_id);
    if (!lockedBooking) return error("Booking request not found", 404);
    if (!["sent", "accepted"].includes(row.status)) return error("Only an active quotation can be revised", 409);
    const previousItems = await listQuotationItemsData(trx, [id]);
    const version = await nextQuotationVersionData(trx, row.booking_request_id);
    const now = new Date();
    await updateQuotationData(trx, id, { status: "superseded", superseded_at: now, updated_at: now });
    const draft = await createQuotationData(trx, { booking_request_id: row.booking_request_id, version, currency: "PHP", base_amount_minor: row.base_amount_minor, total_amount_minor: row.total_amount_minor, status: "draft", created_by: row.created_by });
    await replaceQuotationItemsData(trx, draft.id, previousItems.map(item => ({ quotation_id: draft.id, direction: item.direction, kind: item.kind, description: item.description, amount_minor: item.amount_minor, service_id: item.service_id, customization_request_id: item.customization_request_id, sort_order: item.sort_order })));
    await createAuditEventData(trx, { actor_id: customerId, action: "quotation.revised", entity_type: "quotation", entity_id: draft.id, metadata: JSON.stringify({ previousQuotationId: id, reason }) });
    return quotationDto(trx, draft);
  });
}
