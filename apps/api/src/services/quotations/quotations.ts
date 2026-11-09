import type { Kysely, Selectable, Transaction } from "kysely";
import type { BookingRequests, DB, Quotations } from "../../db/types.js";
import type { QuotationItemInput, QuotationStatus } from "../../controllers/quotations/schemas.js";
import { createAuditEventData } from "../../data/audit/audit-events.js";
import { lockBookingRequestData } from "../../data/booking-requests/booking-requests.js";
import { createBookingMessageData } from "../../data/messages/create-message.js";
import { createQuotationData, findBookingData, findQuotationData, listQuotationItemsData, listQuotationsData, lockQuotationData, nextQuotationVersionData, replaceQuotationItemsData, updateQuotationData } from "../../data/quotations/quotations.js";

import { readPackageSectionsData } from "../../data/packages/catalog-page.js";

const deliveryTerms = (booking: Selectable<BookingRequests>) => ({
  eventType: booking.event_type, preferredDate: booking.preferred_date,
  estimatedDuration: booking.estimated_duration, estimatedDurationDays: booking.estimated_duration_days,
  startsAt: booking.starts_at?.toISOString() ?? null, endsAt: booking.ends_at?.toISOString() ?? null,
  guestCount: booking.guest_count, preferredVenueLocation: booking.preferred_venue_location,
});

async function serviceTerms(db: Kysely<DB>, packageId: string, lock: boolean) {
  const assignments = await db.selectFrom("package_services").select(["service_id", "role", "sort_order"]).where("package_id", "=", packageId).orderBy("sort_order").execute();
  if (!assignments.length) return [];
  let query = db.selectFrom("services").select(["id", "name", "updated_at", "archived_at"]).where("id", "in", assignments.map(item => item.service_id)).orderBy("id");
  if (lock) query = query.forUpdate();
  const services = await query.execute();
  return assignments.map(item => {
    const service = services.find(row => row.id === item.service_id)!;
    return { serviceId: item.service_id, name: service.name, role: item.role, sortOrder: item.sort_order, updatedAt: service.updated_at.toISOString(), archivedAt: service.archived_at?.toISOString() ?? null };
  });
}

async function currentBasis(trx: Transaction<DB>, booking: Selectable<BookingRequests>) {
  const pkg = await trx.selectFrom("packages").selectAll().where("id", "=", booking.package_id).forUpdate().executeTakeFirst();
  if (!pkg) throw new Error("Linked package not found");
  const [sections, services] = await Promise.all([readPackageSectionsData(trx, pkg.id), serviceTerms(trx, pkg.id, true)]);
  const terms = { package: { id: pkg.id, name: pkg.name, description: pkg.description, maxGuests: pkg.max_guests, price: pkg.price, sections, services }, delivery: deliveryTerms(booking) };
  return { pkg, terms, services };
}

function basisMatches(row: Selectable<Quotations>, booking: Selectable<BookingRequests>, pkg: { id: string; updated_at: Date }, services: Awaited<ReturnType<typeof serviceTerms>>) {
  const terms = row.offered_package_terms as { delivery?: unknown; package?: { services?: Record<string, unknown>[] } } | null;
  const offeredServices = terms?.package?.services;
  const sameServices = Array.isArray(offeredServices) && offeredServices.length === services.length && services.every((service, index) => Object.entries(service).every(([key, value]) => offeredServices[index]?.[key] === value));
  return row.offered_package_id === pkg.id && row.offered_package_updated_at?.getTime() === pkg.updated_at.getTime() && !!terms && sameServices && Object.entries(deliveryTerms(booking)).every(([key, value]) => (terms.delivery as Record<string, unknown> | undefined)?.[key] === value);
}

// Always lock the booking before its quotation, matching the package editing path.
async function lockQuoteAndBooking(trx: Transaction<DB>, id: string) {
  const found = await findQuotationData(trx, id);
  if (!found) return null;
  const booking = await lockBookingRequestData(trx, found.booking_request_id);
  if (!booking) return null;
  const row = await lockQuotationData(trx, id);
  return row ? { row, booking } : null;
}

const error = (message: string, status: 400 | 403 | 404 | 409) => ({ message, status });
const total = (baseAmountMinor: number, items: QuotationItemInput[]) => baseAmountMinor + items.reduce((sum, item) => sum + (item.direction === "add" ? item.amountMinor : -item.amountMinor), 0);
const itemRows = (quotationId: string, items: QuotationItemInput[]) => items.map((item, index) => ({ quotation_id: quotationId, direction: item.direction, kind: item.kind, description: item.description, amount_minor: item.amountMinor, service_id: item.serviceId ?? null, sort_order: index }));
const formatPesos = (amountMinor: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amountMinor / 100);

async function quotationDto(db: Kysely<DB>, row: Selectable<Quotations>) {
  const [items, booking] = await Promise.all([listQuotationItemsData(db, [row.id]), db.selectFrom("booking_requests").selectAll().where("id", "=", row.booking_request_id).executeTakeFirstOrThrow()]);
  const pkg = await db.selectFrom("packages").select(["id", "updated_at"]).where("id", "=", booking.package_id).executeTakeFirstOrThrow();
  const services = await serviceTerms(db, pkg.id, false);
  return { id: String(row.id), bookingRequestId: row.booking_request_id, version: row.version, currency: "PHP" as const, baseAmountMinor: row.base_amount_minor, totalAmountMinor: row.total_amount_minor, status: row.status as QuotationStatus, createdBy: row.created_by, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), sentAt: row.sent_at?.toISOString() ?? null, acceptedAt: row.accepted_at?.toISOString() ?? null, supersededAt: row.superseded_at?.toISOString() ?? null, offeredPackageId: row.offered_package_id, offeredPackageUpdatedAt: row.offered_package_updated_at?.toISOString() ?? null, offeredPackageTerms: row.offered_package_terms as Record<string, unknown> | null, basisCurrent: basisMatches(row, booking, pkg, services), adjustmentsReviewed: row.adjustments_reviewed, items: items.map(item => ({ id: String(item.id), direction: item.direction as "add" | "deduct", kind: item.kind as "addition" | "deduction" | "substitution" | "adjustment", description: item.description, amountMinor: item.amount_minor, serviceId: item.service_id, sortOrder: item.sort_order })) };
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
    const { pkg, terms } = await currentBasis(trx, booking);
    const version = await nextQuotationVersionData(trx, bookingId);
    const row = await createQuotationData(trx, { booking_request_id: bookingId, version, currency: "PHP", base_amount_minor: pkg.price * 100, total_amount_minor: pkg.price * 100, status: "draft", created_by: actorId, offered_package_id: pkg.id, offered_package_updated_at: pkg.updated_at, offered_package_terms: JSON.stringify(terms), adjustments_reviewed: true });
    await createAuditEventData(trx, { actor_id: actorId, action: "quotation.created", entity_type: "quotation", entity_id: row.id, metadata: JSON.stringify({ bookingRequestId: bookingId, version }) });
    return quotationDto(trx, row);
  });
}

export async function updateQuotationService(db: Kysely<DB>, id: string, actorId: string, items: QuotationItemInput[], expectedUpdatedAt?: string) {
  return db.transaction().execute(async trx => {
    const locked = await lockQuoteAndBooking(trx, id);
    if (!locked || locked.row.created_by !== actorId) return error("Quotation not found", 404);
    const { row, booking } = locked;
    if (row.status !== "draft") return error("Only draft quotations can be edited", 409);
    if (expectedUpdatedAt && expectedUpdatedAt !== row.updated_at.toISOString()) return error("Quotation changed. Refresh and try again", 409);
    const amount = total(row.base_amount_minor, items);
    if (amount < -2147483648 || amount > 2147483647) return error("Quotation total is outside the supported range", 400);
    const updated = await updateQuotationData(trx, id, { total_amount_minor: amount, adjustments_reviewed: true, updated_at: new Date() });
    await replaceQuotationItemsData(trx, id, itemRows(id, items));
    await createAuditEventData(trx, { actor_id: actorId, action: "quotation.updated", entity_type: "quotation", entity_id: id, metadata: JSON.stringify({ itemCount: items.length }) });
    return quotationDto(trx, updated);
  });
}

export async function sendQuotationService(db: Kysely<DB>, id: string, actorId: string) {
  return db.transaction().execute(async trx => {
    const locked = await lockQuoteAndBooking(trx, id);
    if (!locked || locked.row.created_by !== actorId) return error("Quotation not found", 404);
    const { row, booking } = locked;
    if (row.status !== "draft") return error("Only draft quotations can be sent", 409);
    if (["declined", "cancelled"].includes(booking.status)) return error("This request is closed", 409);
    const { pkg, services } = await currentBasis(trx, booking);
    if (!basisMatches(row, booking, pkg, services)) return error("The package or event details changed. Revise this quotation before sending", 409);
    if (!row.adjustments_reviewed) return error("Review the previous adjustments before sending", 409);
    const items = await listQuotationItemsData(trx, [id]);
    if (!items.length) return error("Add at least one quotation item before sending", 400);
    if (row.total_amount_minor < 0) return error("Quotation total cannot be negative", 400);
    const sentAt = new Date();
    await trx.updateTable("quotations").set({ status: "superseded", superseded_at: sentAt, updated_at: sentAt }).where("booking_request_id", "=", row.booking_request_id).where("status", "in", ["sent", "accepted"]).execute();
    const updated = await updateQuotationData(trx, id, { status: "sent", sent_at: sentAt, updated_at: sentAt });
    await createBookingMessageData(trx, booking.id, booking.customer_id, actorId, "admin", `Quotation #${updated.version} is ready for your review. Total: ${formatPesos(updated.total_amount_minor)}. You can accept it or request a revision here.`);
    await createAuditEventData(trx, { actor_id: actorId, action: "quotation.sent", entity_type: "quotation", entity_id: id, metadata: JSON.stringify({ version: row.version }) });
    return quotationDto(trx, updated);
  });
}

export async function acceptQuotationService(db: Kysely<DB>, id: string, customerId: string) {
  return db.transaction().execute(async trx => {
    const locked = await lockQuoteAndBooking(trx, id);
    if (!locked || locked.booking.customer_id !== customerId) return error("Quotation not found", 404);
    const { row, booking } = locked;
    if (["declined", "cancelled"].includes(booking.status)) return error("This request is closed", 409);
    const { pkg, services } = await currentBasis(trx, booking);
    if (!basisMatches(row, booking, pkg, services)) return error("The package or event details changed. Request a revised quotation", 409);
    if (row.status !== "sent") return error("Only the latest sent quotation can be accepted", 409);
    const active = await trx.selectFrom("quotations").select("id").where("booking_request_id", "=", row.booking_request_id).where("status", "=", "sent").executeTakeFirst();
    if (!active || active.id !== id) return error("Only the latest sent quotation can be accepted", 409);
    const updated = await updateQuotationData(trx, id, { status: "accepted", accepted_at: new Date(), updated_at: new Date() });
    await createBookingMessageData(trx, booking.id, booking.customer_id, customerId, "customer", `I accepted quotation #${updated.version}.`);
    await createAuditEventData(trx, { actor_id: customerId, action: "quotation.accepted", entity_type: "quotation", entity_id: id, metadata: JSON.stringify({ bookingRequestId: row.booking_request_id }) });
    return quotationDto(trx, updated);
  });
}

export async function requestQuotationRevisionService(db: Kysely<DB>, id: string, actorId: string, reason: string, admin = false) {
  return db.transaction().execute(async trx => {
    const locked = await lockQuoteAndBooking(trx, id);
    if (!locked || (admin ? locked.row.created_by !== actorId : locked.booking.customer_id !== actorId)) return error("Quotation not found", 404);
    const { row, booking } = locked;
    if (["declined", "cancelled"].includes(booking.status)) return error("This request is closed", 409);
    if (!(admin ? ["draft", "sent", "accepted"] : ["sent", "accepted"]).includes(row.status)) return error("Only an active quotation can be revised", 409);
    const previousItems = await listQuotationItemsData(trx, [id]);
    const { pkg, terms } = await currentBasis(trx, booking);
    const version = await nextQuotationVersionData(trx, row.booking_request_id);
    const now = new Date();
    const items = previousItems.map(item => ({ direction: item.direction as QuotationItemInput["direction"], kind: item.kind as QuotationItemInput["kind"], description: item.description, amountMinor: item.amount_minor, serviceId: item.service_id }));
    const base = pkg.price * 100;
    const amount = total(base, items);
    if (amount < -2147483648 || amount > 2147483647) return error("Revised quotation total is outside the supported range", 409);
    await updateQuotationData(trx, id, { status: "superseded", superseded_at: now, updated_at: now });
    const draft = await createQuotationData(trx, { booking_request_id: row.booking_request_id, version, currency: "PHP", base_amount_minor: base, total_amount_minor: amount, status: "draft", created_by: row.created_by, offered_package_id: pkg.id, offered_package_updated_at: pkg.updated_at, offered_package_terms: JSON.stringify(terms), adjustments_reviewed: false });
    await replaceQuotationItemsData(trx, draft.id, itemRows(draft.id, items));
    if (!admin) await createBookingMessageData(trx, booking.id, booking.customer_id, actorId, "customer", `I requested a revision for quotation #${row.version}: ${reason}`);
    await createAuditEventData(trx, { actor_id: actorId, action: "quotation.revised", entity_type: "quotation", entity_id: draft.id, metadata: JSON.stringify({ previousQuotationId: id, reason }) });
    return quotationDto(trx, draft);
  });
}
