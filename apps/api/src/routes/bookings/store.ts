import type { Kysely, Selectable, Transaction } from "kysely";
import { sql } from "kysely";
import type { Bookings, BookingServices, DB, Users } from "../../db/types.js";
import type { BookingStatus } from "./schemas.js";
import { VALID_TRANSITIONS } from "./schemas.js";

type Database = Kysely<DB> | Transaction<DB>;
type BookingRow = Selectable<Bookings>;
type ServiceRow = Selectable<BookingServices>;

// ── DTO ──────────────────────────────────────────────────────────────────────

export function serviceDto(
  row: ServiceRow,
  supplierName: string | null = null,
) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    category: row.category,
    supplierId: row.supplier_id,
    supplierName,
    assignmentStatus: row.assignment_status,
    notes: row.notes,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at),
  };
}

export function bookingDto(
  row: BookingRow,
  customer: Selectable<Users>,
  services: ReturnType<typeof serviceDto>[] = [],
) {
  return {
    id:                   row.id,
    customerId:           row.customer_id,
    customerName:         customer.display_name,
    customerEmail:        customer.email,
    status:               row.status as BookingStatus,
    eventName:            row.event_name,
    eventDate:            row.event_date instanceof Date
                            ? row.event_date.toISOString()
                            : String(row.event_date),
    eventStartTime:       row.event_start_time,
    eventEndTime:         row.event_end_time,
    eventType:            row.event_type,
    venueName:            row.venue_name,
    guestCount:           row.guest_count,
    specialNotes:         row.special_notes,
    coordinator:          row.coordinator,
    packageId:            row.package_id,
    totalPriceMinor:      row.total_price_minor,
    reservationFeeMinor:  row.reservation_fee_minor,
    paidAmountMinor:      row.paid_amount_minor,
    paymentStatus:        row.payment_status,
    paymentReference:     row.payment_reference,
    paidAt:               row.paid_at instanceof Date
                            ? row.paid_at.toISOString()
                            : row.paid_at ?? null,
    createdAt:            row.created_at instanceof Date
                            ? row.created_at.toISOString()
                            : String(row.created_at),
    updatedAt:            row.updated_at instanceof Date
                            ? row.updated_at.toISOString()
                            : String(row.updated_at),
    services,
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listBookingRows(
  db: Database,
  filters: { status?: string; customerId?: string } = {},
) {
  let q = db
    .selectFrom("bookings as b")
    .innerJoin("users as u", "u.id", "b.customer_id")
    .selectAll("b")
    .select(["u.display_name", "u.email"])
    .orderBy("b.event_date", "asc");

  if (filters.status) q = q.where("b.status", "=", filters.status);
  if (filters.customerId) q = q.where("b.customer_id", "=", filters.customerId);

  return q.execute();
}

export async function getBookingRow(db: Database, id: string) {
  return db
    .selectFrom("bookings as b")
    .innerJoin("users as u", "u.id", "b.customer_id")
    .selectAll("b")
    .select(["u.display_name", "u.email"])
    .where("b.id", "=", id)
    .executeTakeFirst();
}

export async function lockBookingRow(db: Transaction<DB>, id: string) {
  return db
    .selectFrom("bookings")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
}

// ── Business logic ───────────────────────────────────────────────────────────

/** Returns true if there is already a confirmed/in-preparation booking on the same calendar date. */
export async function isDateConflict(
  db: Database,
  eventDate: Date,
  excludeId?: string,
) {
  // Compare date portion only (ignore time) to treat the venue as exclusive per day.
  const dateStr = eventDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
  let q = db
    .selectFrom("bookings")
    .select("id")
    .where("status", "in", ["confirmed", "in_preparation"])
    .where(sql<string>`to_char(event_date, 'YYYY-MM-DD')`, "=", dateStr);
  if (excludeId) q = q.where("id", "!=", excludeId);
  return !!(await q.executeTakeFirst());
}

/** Returns an error string if the transition is not allowed, otherwise null. */
export function validateTransition(current: string, next: string): string | null {
  const allowed = VALID_TRANSITIONS[current as BookingStatus];
  if (!allowed) return `Unknown current status: ${current}`;
  if (!allowed.includes(next as BookingStatus)) {
    return `Cannot move from "${current}" to "${next}"`;
  }
  return null;
}

/** Merges a joined row (with display_name / email columns) into a user-shaped object. */
export function userFromJoin(row: { display_name: string | null; email: string }): Selectable<Users> {
  // We only need name and email for the DTO; cast the rest as unknown.
  return row as unknown as Selectable<Users>;
}

// ── Service queries ──────────────────────────────────────────────────────────

export async function listServicesForBooking(db: Database, bookingId: string) {
  const rows = await db
    .selectFrom("booking_services as bs")
    .leftJoin("suppliers as s", "s.id", "bs.supplier_id")
    .selectAll("bs")
    .select("s.name as supplier_name")
    .where("bs.booking_id", "=", bookingId)
    .orderBy("bs.created_at", "asc")
    .execute();

  return rows.map((row) =>
    serviceDto(
      {
        id: row.id,
        booking_id: row.booking_id,
        category: row.category,
        supplier_id: row.supplier_id,
        assignment_status: row.assignment_status,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      row.supplier_name,
    ),
  );
}

export async function listServicesForBookings(
  db: Database,
  bookingIds: string[],
): Promise<Map<string, ReturnType<typeof serviceDto>[]>> {
  if (bookingIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("booking_services as bs")
    .leftJoin("suppliers as s", "s.id", "bs.supplier_id")
    .selectAll("bs")
    .select("s.name as supplier_name")
    .where("bs.booking_id", "in", bookingIds)
    .orderBy("bs.created_at", "asc")
    .execute();

  const map = new Map<string, ReturnType<typeof serviceDto>[]>();
  for (const row of rows) {
    const dto = serviceDto(
      {
        id: row.id,
        booking_id: row.booking_id,
        category: row.category,
        supplier_id: row.supplier_id,
        assignment_status: row.assignment_status,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      row.supplier_name,
    );
    const list = map.get(row.booking_id) ?? [];
    list.push(dto);
    map.set(row.booking_id, list);
  }
  return map;
}

/**
 * Check if adding a confirmed service creates a supplier conflict.
 * Returns error if the supplier is already confirmed for another booking
 * at overlapping date/time.
 */
export async function checkServiceConflict(
  db: Database,
  supplierId: string | null,
  assignmentStatus: string,
  eventDate: Date,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
): Promise<string | null> {
  if (!supplierId || assignmentStatus !== "confirmed") return null;

  const dateStr = eventDate.toISOString().slice(0, 10); // YYYY-MM-DD

  let q = db
    .selectFrom("booking_services as bs")
    .innerJoin("bookings as b", "b.id", "bs.booking_id")
    .select(["b.event_name", "b.event_start_time", "b.event_end_time"])
    .where("bs.supplier_id", "=", supplierId)
    .where("bs.assignment_status", "=", "confirmed")
    .where("b.status", "in", ["confirmed", "in_preparation"])
    .where((eb) =>
      eb("b.event_date", ">=", new Date(`${dateStr}T00:00:00Z`))
        .and("b.event_date", "<", new Date(`${dateStr}T23:59:59Z`)),
    );

  if (excludeBookingId) q = q.where("b.id", "!=", excludeBookingId);

  const conflicts = await q.execute();

  for (const conflict of conflicts) {
    const cStart = conflict.event_start_time;
    const cEnd = conflict.event_end_time;
    if (startTime < cEnd && endTime > cStart) {
      return `Supplier is already confirmed for "${conflict.event_name}" at ${cStart}–${cEnd} on this date`;
    }
  }

  return null;
}
