import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, Suppliers, BookingServices } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;
type SupplierRow = Selectable<Suppliers>;

// ── DTO ──────────────────────────────────────────────────────────────────────

export function supplierDto(row: SupplierRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contactNumber: row.contact_number,
    email: row.email,
    notes: row.notes,
    isInternal: row.is_internal,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at),
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function listSupplierRows(
  db: Database,
  filters: { category?: string; search?: string } = {},
) {
  let q = db
    .selectFrom("suppliers")
    .selectAll()
    .orderBy("name", "asc");

  if (filters.category) {
    q = q.where("category", "=", filters.category);
  }

  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    q = q.where((eb) =>
      eb.or([
        eb("name", "ilike", term),
        eb("email", "ilike", term),
      ])
    );
  }

  return q.execute();
}

export async function getSupplierRow(db: Database, id: string) {
  return db
    .selectFrom("suppliers")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

// ── Availability logic ───────────────────────────────────────────────────────

/**
 * Check if a supplier has conflicting confirmed assignments on the given date/time.
 * Returns conflicting booking details if unavailable.
 */
export async function checkSupplierAvailability(
  db: Database,
  supplierId: string,
  eventDate: string, // YYYY-MM-DD
  startTime: string, // HH:mm
  endTime: string, // HH:mm
) {
  // Find confirmed booking_services for this supplier on the same date
  const conflicts = await db
    .selectFrom("booking_services as bs")
    .innerJoin("bookings as b", "b.id", "bs.booking_id")
    .select([
      "b.id as bookingId",
      "b.event_name as eventName",
      "b.event_date as eventDate",
      "b.event_start_time as eventStartTime",
      "b.event_end_time as eventEndTime",
    ])
    .where("bs.supplier_id", "=", supplierId)
    .where("bs.assignment_status", "=", "confirmed")
    .where("b.status", "in", ["confirmed", "in_preparation"])
    .where((eb) => {
      // Match date portion (ignore time part of timestamp)
      const dateStr = eventDate; // already YYYY-MM-DD
      return eb("b.event_date", ">=", new Date(`${dateStr}T00:00:00Z`))
        .and("b.event_date", "<", new Date(`${dateStr}T23:59:59Z`));
    })
    .execute();

  // Check for time overlap
  const overlapping = conflicts.filter((conflict) => {
    const cStart = conflict.eventStartTime;
    const cEnd = conflict.eventEndTime;
    // Times overlap if: start < conflict.end AND end > conflict.start
    return startTime < cEnd && endTime > cStart;
  });

  return {
    available: overlapping.length === 0,
    conflictingBookings: overlapping.map((c) => ({
      bookingId: c.bookingId,
      eventName: c.eventName,
      eventDate: c.eventDate instanceof Date ? c.eventDate.toISOString() : String(c.eventDate),
      eventStartTime: c.eventStartTime,
      eventEndTime: c.eventEndTime,
    })),
  };
}
