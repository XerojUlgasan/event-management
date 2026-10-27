import type { Kysely, Selectable, Transaction } from "kysely";
import { sql } from "kysely";
import type { Bookings, DB, Users } from "../../db/types.js";
import type { BookingStatus } from "./schemas.js";
import { VALID_TRANSITIONS } from "./schemas.js";

type Database = Kysely<DB> | Transaction<DB>;
type BookingRow = Selectable<Bookings>;

// ── DTO ──────────────────────────────────────────────────────────────────────

export function bookingDto(row: BookingRow, customer: Selectable<Users>) {
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
