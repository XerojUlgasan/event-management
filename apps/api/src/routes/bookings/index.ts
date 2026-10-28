import { randomUUID } from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { body, commonErrors, json, requireAdmin, routeError } from "../../lib/api-helpers.js";
import {
  bookingListSchema,
  bookingSchema,
  createBookingSchema,
  recordPaymentSchema,
  updateBookingSchema,
  updateStatusSchema,
} from "./schemas.js";
import {
  bookingDto,
  getBookingRow,
  isDateConflict,
  listBookingRows,
  listServicesForBooking,
  listServicesForBookings,
  lockBookingRow,
  userFromJoin,
  validateTransition,
  checkServiceConflict,
} from "./store.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") },
        400,
      );
    }
  },
});

const errors = commonErrors("booking");
const idParam = z.object({ id: z.string().uuid() });

routes.use("/admin/bookings", requireSession, requireAdmin);
routes.use("/admin/bookings/*", requireSession, requireAdmin);

// ── GET /admin/bookings ──────────────────────────────────────────────────────

const listRoute = createRoute({
  method: "get",
  path: "/admin/bookings",
  tags: ["Bookings"],
  request: {
    query: z.object({
      status:     z.string().optional(),
      customerId: z.string().uuid().optional(),
    }),
  },
  responses: {
    200: { content: json(bookingListSchema), description: "List of bookings" },
    ...errors,
  },
});
routes.openapi(listRoute, async (c) => {
  const { status, customerId } = c.req.valid("query");
  const rows = await listBookingRows(c.get("db"), { status, customerId });
  const bookingIds = rows.map((r) => r.id);
  const servicesMap = await listServicesForBookings(c.get("db"), bookingIds);
  const bookings = rows.map((row) =>
    bookingDto(row, userFromJoin(row), servicesMap.get(row.id) ?? []),
  );
  return c.json({ bookings }, 200);
});

// ── POST /admin/bookings ─────────────────────────────────────────────────────

const createRoute_ = createRoute({
  method: "post",
  path: "/admin/bookings",
  tags: ["Bookings"],
  request: { body: body(createBookingSchema) },
  responses: {
    201: { content: json(bookingSchema), description: "Booking created" },
    ...errors,
  },
});
routes.openapi(createRoute_, async (c) => {
  const data = c.req.valid("json");
  const db = c.get("db");

  // Verify customer exists
  const customer = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", data.customerId)
    .executeTakeFirst();
  if (!customer) return c.json({ error: "Customer not found" }, 404);

  // Date must be in the future
  const eventDate = new Date(data.eventDate);
  if (eventDate <= new Date()) return c.json({ error: "Event date must be in the future" }, 400);

  // Conflict check
  if (await isDateConflict(db, eventDate)) {
    return c.json({ error: "A confirmed or in-preparation booking already exists for that date" }, 409);
  }

  // Check service conflicts
  if (data.services) {
    for (const service of data.services) {
      const conflict = await checkServiceConflict(
        db,
        service.supplierId,
        service.assignmentStatus ?? "pending",
        eventDate,
        data.eventStartTime,
        data.eventEndTime,
      );
      if (conflict) return c.json({ error: conflict }, 409);
    }
  }

  const outcome = await db.transaction().execute(async (trx) => {
    const bookingId = randomUUID();
    const row = await trx
      .insertInto("bookings")
      .values({
        id: bookingId,
        customer_id: data.customerId,
        event_name: data.eventName,
        event_date: eventDate,
        event_start_time: data.eventStartTime,
        event_end_time: data.eventEndTime,
        event_type: data.eventType,
        venue_name: data.venueName,
        guest_count: data.guestCount,
        special_notes: data.specialNotes ?? null,
        coordinator: data.coordinator ?? "Unassigned",
        package_id: data.packageId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Insert services
    if (data.services && data.services.length > 0) {
      await trx
        .insertInto("booking_services")
        .values(
          data.services.map((s) => ({
            id: randomUUID(),
            booking_id: bookingId,
            category: s.category,
            supplier_id: s.supplierId,
            assignment_status: s.assignmentStatus ?? "pending",
            notes: s.notes ?? null,
          })),
        )
        .execute();
    }

    const services = await listServicesForBooking(trx, bookingId);
    return bookingDto(row, customer, services);
  });

  return c.json(outcome, 201);
});

// ── GET /admin/bookings/:id ──────────────────────────────────────────────────

const getRoute = createRoute({
  method: "get",
  path: "/admin/bookings/{id}",
  tags: ["Bookings"],
  request: { params: idParam },
  responses: {
    200: { content: json(bookingSchema), description: "Booking detail" },
    ...errors,
  },
});
routes.openapi(getRoute, async (c) => {
  const row = await getBookingRow(c.get("db"), c.req.valid("param").id);
  if (!row) return c.json({ error: "Booking not found" }, 404);
  const services = await listServicesForBooking(c.get("db"), row.id);
  return c.json(bookingDto(row, userFromJoin(row), services), 200);
});

// ── PATCH /admin/bookings/:id ────────────────────────────────────────────────

const updateRoute = createRoute({
  method: "patch",
  path: "/admin/bookings/{id}",
  tags: ["Bookings"],
  request: { params: idParam, body: body(updateBookingSchema) },
  responses: {
    200: { content: json(bookingSchema), description: "Updated booking" },
    ...errors,
  },
});
routes.openapi(updateRoute, async (c) => {
  const data = c.req.valid("json");
  const db = c.get("db");

  const outcome = await db.transaction().execute(async (trx) => {
    const booking = await lockBookingRow(trx, c.req.valid("param").id);
    if (!booking) return routeError("Booking not found", 404);
    if (["completed", "cancelled"].includes(booking.status)) {
      return routeError("Cannot edit a completed or cancelled booking", 409);
    }

    // Determine effective date/times for conflict checks
    const effectiveDate = data.eventDate ? new Date(data.eventDate) : booking.event_date;
    const effectiveStart = data.eventStartTime ?? booking.event_start_time;
    const effectiveEnd = data.eventEndTime ?? booking.event_end_time;

    // If changing date, check for conflicts
    if (data.eventDate) {
      if (effectiveDate <= new Date()) return routeError("Event date must be in the future", 400);
      if (await isDateConflict(trx, effectiveDate, booking.id)) {
        return routeError("A confirmed or in-preparation booking already exists for that date", 409);
      }
    }

    // Check service conflicts for confirmed services
    if (data.services) {
      for (const service of data.services) {
        const conflict = await checkServiceConflict(
          trx,
          service.supplierId,
          service.assignmentStatus ?? "pending",
          effectiveDate,
          effectiveStart,
          effectiveEnd,
          booking.id,
        );
        if (conflict) return routeError(conflict, 409);
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.eventName       !== undefined) updates.event_name       = data.eventName;
    if (data.eventDate       !== undefined) updates.event_date       = new Date(data.eventDate);
    if (data.eventStartTime  !== undefined) updates.event_start_time = data.eventStartTime;
    if (data.eventEndTime    !== undefined) updates.event_end_time   = data.eventEndTime;
    if (data.eventType       !== undefined) updates.event_type       = data.eventType;
    if (data.venueName       !== undefined) updates.venue_name       = data.venueName;
    if (data.guestCount      !== undefined) updates.guest_count      = data.guestCount;
    if (data.coordinator     !== undefined) updates.coordinator      = data.coordinator;
    if (data.specialNotes    !== undefined) updates.special_notes    = data.specialNotes;
    if (data.packageId       !== undefined) updates.package_id      = data.packageId;
    if (data.totalPriceMinor     !== undefined) updates.total_price_minor     = data.totalPriceMinor;
    if (data.reservationFeeMinor !== undefined) updates.reservation_fee_minor = data.reservationFeeMinor;

    const hasFieldUpdates = Object.keys(updates).length > 0;
    const hasServiceUpdates = data.services !== undefined;

    if (!hasFieldUpdates && !hasServiceUpdates) {
      return routeError("No fields to update", 400);
    }

    if (hasFieldUpdates) {
      updates.updated_at = new Date();
      await trx
        .updateTable("bookings")
        .set(updates)
        .where("id", "=", booking.id)
        .execute();
    }

    // Replace services if provided (full sync)
    if (hasServiceUpdates) {
      await trx.deleteFrom("booking_services").where("booking_id", "=", booking.id).execute();
      if (data.services && data.services.length > 0) {
        await trx
          .insertInto("booking_services")
          .values(
            data.services.map((s) => ({
              id: randomUUID(),
              booking_id: booking.id,
              category: s.category,
              supplier_id: s.supplierId,
              assignment_status: s.assignmentStatus ?? "pending",
              notes: s.notes ?? null,
            })),
          )
          .execute();
      }
    }

    return trx
      .selectFrom("bookings")
      .selectAll()
      .where("id", "=", booking.id)
      .executeTakeFirstOrThrow();
  });

  if ("status" in outcome && "message" in outcome) {
    return c.json({ error: outcome.message }, outcome.status);
  }

  const customer = await c.get("db")
    .selectFrom("users").selectAll()
    .where("id", "=", outcome.customer_id)
    .executeTakeFirstOrThrow();

  const services = await listServicesForBooking(c.get("db"), outcome.id);
  return c.json(bookingDto(outcome, customer, services), 200);
});

// ── POST /admin/bookings/:id/status ─────────────────────────────────────────

const statusRoute = createRoute({
  method: "post",
  path: "/admin/bookings/{id}/status",
  tags: ["Bookings"],
  request: { params: idParam, body: body(updateStatusSchema) },
  responses: {
    200: { content: json(bookingSchema), description: "Updated booking" },
    ...errors,
  },
});
routes.openapi(statusRoute, async (c) => {
  const { status: nextStatus } = c.req.valid("json");
  const db = c.get("db");

  const outcome = await db.transaction().execute(async (trx) => {
    const booking = await lockBookingRow(trx, c.req.valid("param").id);
    if (!booking) return routeError("Booking not found", 404);

    const err = validateTransition(booking.status, nextStatus);
    if (err) return routeError(err, 409);

    // Require at least the reservation fee paid before confirming
    if (
      nextStatus === "confirmed" &&
      booking.reservation_fee_minor > 0 &&
      booking.paid_amount_minor < booking.reservation_fee_minor
    ) {
      return routeError(
        "Reservation fee must be paid before confirming. Record the payment first or set reservation fee to 0.",
        409,
      );
    }

    return trx
      .updateTable("bookings")
      .set({ status: nextStatus, updated_at: new Date() })
      .where("id", "=", booking.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  });

  if ("status" in outcome && "message" in outcome) {
    return c.json({ error: outcome.message }, outcome.status);
  }

  const customer = await db
    .selectFrom("users").selectAll()
    .where("id", "=", outcome.customer_id)
    .executeTakeFirstOrThrow();

  const services = await listServicesForBooking(db, outcome.id);
  return c.json(bookingDto(outcome, customer, services), 200);
});

// ── POST /admin/bookings/:id/payment ────────────────────────────────────────

const paymentRoute = createRoute({
  method: "post",
  path: "/admin/bookings/{id}/payment",
  tags: ["Bookings"],
  request: { params: idParam, body: body(recordPaymentSchema) },
  responses: {
    200: { content: json(bookingSchema), description: "Payment recorded" },
    ...errors,
  },
});
routes.openapi(paymentRoute, async (c) => {
  const { amountMinor, paymentReference } = c.req.valid("json");
  const db = c.get("db");

  const outcome = await db.transaction().execute(async (trx) => {
    const booking = await lockBookingRow(trx, c.req.valid("param").id);
    if (!booking) return routeError("Booking not found", 404);
    if (booking.status === "cancelled") return routeError("Cannot record payment for a cancelled booking", 409);

    const newPaid = booking.paid_amount_minor + amountMinor;
    const isFullyPaid = booking.reservation_fee_minor > 0 && newPaid >= booking.reservation_fee_minor;

    return trx
      .updateTable("bookings")
      .set({
        paid_amount_minor:  newPaid,
        payment_reference:  paymentReference ?? booking.payment_reference,
        payment_status:     isFullyPaid ? "completed" : "partial",
        paid_at:            isFullyPaid && !booking.paid_at ? new Date() : booking.paid_at,
        updated_at:         new Date(),
      })
      .where("id", "=", booking.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  });

  if ("status" in outcome && "message" in outcome) {
    return c.json({ error: outcome.message }, outcome.status);
  }

  const customer = await db
    .selectFrom("users").selectAll()
    .where("id", "=", outcome.customer_id)
    .executeTakeFirstOrThrow();

  const services = await listServicesForBooking(db, outcome.id);
  return c.json(bookingDto(outcome, customer, services), 200);
});

// ── DELETE /admin/bookings/:id ───────────────────────────────────────────────

const deleteRoute = createRoute({
  method: "delete",
  path: "/admin/bookings/{id}",
  tags: ["Bookings"],
  request: { params: idParam },
  responses: {
    204: { description: "Booking deleted" },
    ...errors,
  },
});
routes.openapi(deleteRoute, async (c) => {
  const db = c.get("db");
  const outcome = await db.transaction().execute(async (trx) => {
    const booking = await lockBookingRow(trx, c.req.valid("param").id);
    if (!booking) return routeError("Booking not found", 404);
    if (["confirmed", "in_preparation"].includes(booking.status)) {
      return routeError("Cannot delete a confirmed or in-preparation booking. Cancel it first.", 409);
    }
    await trx.deleteFrom("bookings").where("id", "=", booking.id).execute();
    return null;
  });

  if (outcome && "status" in outcome) return c.json({ error: outcome.message }, outcome.status);
  return c.body(null, 204);
});

export default routes;
