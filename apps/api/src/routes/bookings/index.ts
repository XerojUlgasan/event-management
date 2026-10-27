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
  lockBookingRow,
  userFromJoin,
  validateTransition,
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
  const bookings = rows.map(row => bookingDto(row, userFromJoin(row)));
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

  const row = await db
    .insertInto("bookings")
    .values({
      id:           randomUUID(),
      customer_id:  data.customerId,
      event_name:   data.eventName,
      event_date:   eventDate,
      guest_count:  data.guestCount,
      special_notes: data.specialNotes ?? null,
      coordinator:  data.coordinator ?? "Unassigned",
      package_id:   data.packageId ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return c.json(bookingDto(row, customer), 201);
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
  return c.json(bookingDto(row, userFromJoin(row)), 200);
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

    // If changing date, check for conflicts
    if (data.eventDate) {
      const eventDate = new Date(data.eventDate);
      if (eventDate <= new Date()) return routeError("Event date must be in the future", 400);
      if (await isDateConflict(trx, eventDate, booking.id)) {
        return routeError("A confirmed or in-preparation booking already exists for that date", 409);
      }
    }

    const updates: Record<string, unknown> = {};
    if (data.eventName    !== undefined) updates.event_name    = data.eventName;
    if (data.eventDate    !== undefined) updates.event_date    = new Date(data.eventDate);
    if (data.guestCount   !== undefined) updates.guest_count   = data.guestCount;
    if (data.coordinator  !== undefined) updates.coordinator   = data.coordinator;
    if (data.specialNotes !== undefined) updates.special_notes = data.specialNotes;
    if (data.packageId    !== undefined) updates.package_id    = data.packageId;
    if (data.totalPriceMinor     !== undefined) updates.total_price_minor     = data.totalPriceMinor;
    if (data.reservationFeeMinor !== undefined) updates.reservation_fee_minor = data.reservationFeeMinor;

    if (Object.keys(updates).length === 0) return routeError("No fields to update", 400);
    updates.updated_at = new Date();

    return trx
      .updateTable("bookings")
      .set(updates)
      .where("id", "=", booking.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  });

  if ("status" in outcome && "message" in outcome) {
    return c.json({ error: outcome.message }, outcome.status);
  }

  const customer = await c.get("db")
    .selectFrom("users").selectAll()
    .where("id", "=", outcome.customer_id)
    .executeTakeFirstOrThrow();

  return c.json(bookingDto(outcome, customer), 200);
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

  return c.json(bookingDto(outcome, customer), 200);
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

  return c.json(bookingDto(outcome, customer), 200);
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
