import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";
import { CUSTOMIZATION_REQUEST_TYPES } from "@event-management/contracts/limits/booking-requests";

const database = `em_customization_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let staffCookie: string;
let customerCookie: string;
let otherCustomerCookie: string;
let customerId: string;
let packageId: string;

before(async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST ?? "localhost"),
    "Tests require local PostgreSQL",
  );
  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
  }
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));

  async function session(role: string, name: string) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${role}-${randomUUID()}@example.test`,
        display_name: name,
        password_hash: "unused",
        role,
        staff_role: role === "admin" ? "System Administrator" : null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("sessions")
      .values({
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3600000),
      })
      .execute();
    return { cookie: `em_session=${token}`, id: user.id };
  }

  ({ cookie: adminCookie } = await session("admin", "Admin Person"));
  ({ cookie: staffCookie } = await session("staff", "Staff Person"));
  const customer = await session("customer", "Customer One");
  customerCookie = customer.cookie;
  customerId = customer.id;
  const other = await session("customer", "Customer Two");
  otherCustomerCookie = other.cookie;

  const pkg = await db
    .insertInto("packages")
    .values({ name: "Garden Wedding", max_guests: 100, price: 150_000 })
    .returning("id")
    .executeTakeFirstOrThrow();
  packageId = pkg.id;
});

after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

function call(path: string, method = "GET", body?: unknown, cookie?: string) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}

const bookingInput = (overrides: Record<string, unknown> = {}) => ({
  packageId,
  eventType: "Wedding",
  preferredDate: "2099-01-02",
  estimatedDuration: "8_hours",
  timeZone: "Asia/Manila",
  guestCount: 80,
  contactName: "Customer One",
  phoneNumber: "123",
  preferredVenueLocation: "Garden Hall",
  ...overrides,
});

async function createBooking(overrides: Record<string, unknown> = {}) {
  return (await read(
    await call("/booking-requests", "POST", bookingInput(overrides), customerCookie),
    201,
  )).bookingRequest;
}

async function customization(
  bookingId: string,
  type: string,
  description = "Please adjust this",
  cookie = adminCookie,
  extra: Record<string, unknown> = {},
) {
  return read(
    await call(
      `/admin/booking-requests/${bookingId}/customization-requests`,
      "POST",
      { type, description, ...extra },
      cookie,
    ),
    201,
  );
}

test("arrangement edits are admin-only, concurrency-safe, and leave the request untouched", async () => {
  const booking = await createBooking();
  assert.ok(booking.arrangement);
  assert.equal(booking.arrangement.id !== booking.id, true);
  assert.equal(booking.arrangement.eventType, "Wedding");
  assert.equal(booking.arrangement.guestCount, 80);
  assert.equal(booking.arrangement.preferredVenueLocation, "Garden Hall");
  assert.equal(booking.arrangement.outOfRange, false);
  assert.equal(booking.arrangement.updatedByName, "Customer One");

  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { guestCount: 90 }), 401);
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { guestCount: 90 }, customerCookie), 403);
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { guestCount: 90 }, staffCookie), 403);
  await read(await call(`/admin/booking-requests/${randomUUID()}/arrangement`, "PATCH", { guestCount: 90 }, adminCookie), 404);

  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", {}, adminCookie), 400);
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { expectedUpdatedAt: booking.arrangement.updatedAt }, adminCookie), 400);
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { estimatedDuration: "more_than_1_week" }, adminCookie), 400);
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { estimatedDuration: "8_hours", estimatedDurationDays: 8 }, adminCookie), 400);
  await read(
    await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", {
      startsAt: "2098-01-01T10:00:00.000Z",
      endsAt: "2098-01-01T09:00:00.000Z",
    }, adminCookie),
    400,
  );
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { guestCount: 0 }, adminCookie), 400);
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { notes: "x".repeat(4001) }, adminCookie), 400);
  await read(await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", { unknown: true }, adminCookie), 400);
  await read(
    await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", {
      expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
      guestCount: 90,
    }, adminCookie),
    409,
  );

  const edited = (await read(
    await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", {
      expectedUpdatedAt: booking.arrangement.updatedAt,
      eventType: "Reception",
      preferredDate: "2099-03-04",
      estimatedDuration: "more_than_1_week",
      estimatedDurationDays: 9,
      startsAt: "2099-03-04T10:00:00.000Z",
      endsAt: "2099-03-04T20:00:00.000Z",
      guestCount: 150,
      preferredVenueLocation: "Garden Tent",
      notes: "Move the ceremony indoors",
    }, adminCookie),
    200,
  )).bookingRequest;

  assert.equal(edited.arrangement.eventType, "Reception");
  assert.equal(edited.arrangement.preferredDate, "2099-03-04");
  assert.equal(edited.arrangement.estimatedDuration, "more_than_1_week");
  assert.equal(edited.arrangement.estimatedDurationDays, 9);
  assert.equal(edited.arrangement.guestCount, 150);
  assert.equal(edited.arrangement.outOfRange, true);
  assert.equal(edited.arrangement.preferredVenueLocation, "Garden Tent");
  assert.equal(edited.arrangement.notes, "Move the ceremony indoors");
  assert.equal(edited.arrangement.updatedByName, "Admin Person");

  // The immutable request snapshot is not rewritten by arrangement edits.
  assert.equal(edited.eventType, "Wedding");
  assert.equal(edited.preferredDate, "2099-01-02");
  assert.equal(edited.guestCount, 80);
  assert.equal(edited.outOfRange, false);
  assert.equal(edited.preferredVenueLocation, "Garden Hall");
  assert.deepEqual(
    (await pool.query(
      "SELECT event_type, preferred_date, guest_count, out_of_range, preferred_venue_location FROM booking_requests WHERE id = $1",
      [booking.id],
    )).rows[0],
    {
      event_type: "Wedding",
      preferred_date: "2099-01-02",
      guest_count: 80,
      out_of_range: false,
      preferred_venue_location: "Garden Hall",
    },
  );
  assert.deepEqual(
    (await pool.query(
      "SELECT event_type, guest_count, preferred_venue_location, notes FROM booking_arrangements WHERE booking_request_id = $1",
      [booking.id],
    )).rows[0],
    {
      event_type: "Reception",
      guest_count: 150,
      preferred_venue_location: "Garden Tent",
      notes: "Move the ceremony indoors",
    },
  );

  const cleared = (await read(
    await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", {
      expectedUpdatedAt: edited.arrangement.updatedAt,
      guestCount: null,
      preferredVenueLocation: "   ",
      notes: null,
    }, adminCookie),
    200,
  )).bookingRequest;
  assert.equal(cleared.arrangement.guestCount, null);
  assert.equal(cleared.arrangement.outOfRange, false);
  assert.equal(cleared.arrangement.preferredVenueLocation, null);
  assert.equal(cleared.arrangement.notes, null);

  const audits = await db
    .selectFrom("audit_events")
    .selectAll()
    .where("entity_type", "=", "booking_arrangement")
    .where("entity_id", "=", booking.id)
    .orderBy("created_at", "asc")
    .execute();
  assert.deepEqual(audits.map((event) => event.action).sort(), [
    "arrangement.created",
    "arrangement.updated",
    "arrangement.updated",
  ]);
  assert.ok(audits.every((event) => event.actor_id !== null));

  const cancelledRequest = await createBooking();
  await read(await call("/booking-requests/" + cancelledRequest.id + "/cancel", "PATCH", { reason: "Change of plans" }, customerCookie), 200);
  await read(await call(`/admin/booking-requests/${cancelledRequest.id}/arrangement`, "PATCH", { guestCount: 90 }, adminCookie), 409);
});

test("customers submit every customization type and only administrators decide", async () => {
  const booking = await createBooking();
  const conversation = await db
    .selectFrom("conversations")
    .selectAll()
    .where("booking_request_id", "=", booking.id)
    .executeTakeFirstOrThrow();
  const message = await db
    .insertInto("messages")
    .values({
      conversation_id: conversation.id,
      sender_id: customerId,
      sender_role: "customer",
      body: "Could we swap the main course?",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  let latest = booking;
  for (const [index, type] of CUSTOMIZATION_REQUEST_TYPES.entries()) {
    const result = await customization(booking.id, type, `Change number ${index + 1}`);
    latest = result.bookingRequest;
    const created = latest.customizationRequests.find(
      (request: any) => request.description === `Change number ${index + 1}`,
    );
    assert.equal(created.type, type);
    assert.equal(created.status, "requested");
    assert.equal(created.requestedBy, customerId);
    assert.equal(created.requestedByName, "Customer One");
    assert.equal(created.decidedBy, null);
    assert.equal(created.decidedAt, null);
    assert.equal(latest.pendingCustomizationRequests, index + 1);
  }
  assert.equal(latest.customizationRequests.length, CUSTOMIZATION_REQUEST_TYPES.length);

  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: " " }, customerCookie), 400);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "x".repeat(4001) }, customerCookie), 400);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "not_a_type", description: "Change" }, customerCookie), 400);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change", extra: true }, customerCookie), 400);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change" }), 401);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change" }, otherCustomerCookie), 404);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change" }, adminCookie), 403);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change" }, staffCookie), 403);
  await read(await call(`/booking-requests/${randomUUID()}/customization-requests`, "POST", { type: "add_inclusions", description: "Change" }, customerCookie), 404);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change", messageId: message.id }, customerCookie), 400);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change", conversationId: randomUUID() }, customerCookie), 404);
  await read(await call(`/booking-requests/${booking.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Change", conversationId: conversation.id, messageId: randomUUID() }, customerCookie), 404);

  const linked = await customization(
    booking.id,
    "modify_inclusions",
    "Link this to my message",
    customerCookie,
    { conversationId: conversation.id, messageId: message.id },
  );
  const linkedRequest = linked.bookingRequest.customizationRequests.find(
    (request: any) => request.description === "Link this to my message",
  );
  assert.equal(linkedRequest.conversationId, conversation.id);
  assert.equal(linkedRequest.messageId, message.id);
  assert.equal(linked.bookingRequest.pendingCustomizationRequests, 9);

  // Another customer's conversation cannot be attached to this booking.
  const otherBooking = (await read(
    await call("/booking-requests", "POST", bookingInput({ contactName: "Other" }), otherCustomerCookie),
    201,
  )).bookingRequest;
  const otherConversation = await db
    .selectFrom("conversations")
    .selectAll()
    .where("booking_request_id", "=", otherBooking.id)
    .executeTakeFirstOrThrow();
  await read(
    await call(`/booking-requests/${booking.id}/customization-requests`, "POST", {
      type: "add_inclusions",
      description: "Wrong conversation",
      conversationId: otherConversation.id,
    }, customerCookie),
    404,
  );

  const pending = linked.bookingRequest.customizationRequests.find(
    (request: any) => request.type === "add_inclusions",
  );
  assert.ok(pending);
  const approved = (await read(
    await call(`/admin/customization-requests/${pending.id}`, "PATCH", { decision: "approved", reason: "We can do that" }, adminCookie),
    200,
  )).bookingRequest;
  const approvedRequest = approved.customizationRequests.find((request: any) => request.id === pending.id);
  assert.equal(approvedRequest.status, "approved");
  assert.equal(approvedRequest.decisionReason, "We can do that");
  assert.equal(approvedRequest.decidedByName, "Admin Person");
  assert.equal(approvedRequest.decidedBy !== null, true);
  assert.equal(approved.pendingCustomizationRequests, 8);
  await read(await call(`/admin/customization-requests/${pending.id}`, "PATCH", { decision: "approved" }, adminCookie), 409);

  const rejectedTarget = approved.customizationRequests.find((request: any) => request.status === "requested");
  await read(await call(`/admin/customization-requests/${rejectedTarget.id}`, "PATCH", { decision: "rejected" }, adminCookie), 400);
  await read(await call(`/admin/customization-requests/${rejectedTarget.id}`, "PATCH", { decision: "rejected", reason: "   " }, adminCookie), 400);
  await read(await call(`/admin/customization-requests/${randomUUID()}`, "PATCH", { decision: "approved" }, adminCookie), 404);

  // A different customer cannot withdraw the request; staff and customers cannot decide.
  await read(await call(`/customization-requests/${rejectedTarget.id}/withdraw`, "PATCH", undefined, otherCustomerCookie), 404);
  await read(await call(`/customization-requests/${rejectedTarget.id}/withdraw`, "PATCH", undefined, adminCookie), 403);
  await read(await call(`/customization-requests/${rejectedTarget.id}/withdraw`, "PATCH", undefined, staffCookie), 403);
  await read(await call(`/admin/customization-requests/${rejectedTarget.id}`, "PATCH", { decision: "rejected", reason: "No" }, staffCookie), 403);
  await read(await call(`/admin/customization-requests/${rejectedTarget.id}`, "PATCH", { decision: "rejected", reason: "No" }, customerCookie), 403);

  const withdrawn = (await read(
    await call(`/customization-requests/${rejectedTarget.id}/withdraw`, "PATCH", undefined, customerCookie),
    200,
  )).bookingRequest;
  assert.equal(
    withdrawn.customizationRequests.find((request: any) => request.id === rejectedTarget.id).status,
    "withdrawn",
  );
  assert.equal(withdrawn.pendingCustomizationRequests, 7);
  await read(await call(`/customization-requests/${rejectedTarget.id}/withdraw`, "PATCH", undefined, customerCookie), 409);
  await read(await call(`/admin/customization-requests/${rejectedTarget.id}`, "PATCH", { decision: "rejected", reason: "No" }, adminCookie), 409);

  const rejected = (await read(
    await call(`/admin/customization-requests/${withdrawn.customizationRequests.find((request: any) => request.status === "requested").id}`, "PATCH", { decision: "rejected", reason: "Not available" }, adminCookie),
    200,
  )).bookingRequest;
  const rejectedRequest = rejected.customizationRequests.find((request: any) => request.decisionReason === "Not available");
  assert.equal(rejectedRequest.status, "rejected");
  assert.equal(rejectedRequest.decidedByName, "Admin Person");
  assert.equal(rejected.pendingCustomizationRequests, 6);

  // Decisions never rewrite the original request snapshot.
  assert.equal(rejected.eventType, "Wedding");
  assert.equal(rejected.guestCount, 80);
  assert.equal(rejected.preferredDate, "2099-01-02");

  const auditActions = (await db
    .selectFrom("audit_events")
    .select("action")
    .where("entity_type", "=", "customization_request")
    .execute()).map((event) => event.action);
  assert.equal(auditActions.filter((action) => action === "customization_request.created").length >= 9, true);
  for (const action of [
    "customization_request.approved",
    "customization_request.rejected",
    "customization_request.withdrawn",
  ]) {
    assert.ok(auditActions.includes(action), `${action} audit event missing`);
  }

  const terminalRequest = await createBooking();
  await read(await call(`/booking-requests/${terminalRequest.id}/cancel`, "PATCH", { reason: "Change of plans" }, customerCookie), 200);
  await read(await call(`/booking-requests/${terminalRequest.id}/customization-requests`, "POST", { type: "add_inclusions", description: "Too late" }, customerCookie), 409);
  await read(await call("/admin/customization-requests", "GET", undefined, customerCookie), 403);
  assert.ok((await read(await call("/admin/customization-requests", "GET", undefined, staffCookie), 200)).requests.length >= 1);
});

test("the admin queue filters and paginates pending customization requests", async () => {
  const firstBooking = await createBooking();
  const secondBooking = await createBooking();
  const ids: string[] = [];
  for (const [index, type] of ["add_inclusions", "remove_inclusions", "change_venue"].entries()) {
    const booking = index === 2 ? secondBooking : firstBooking;
    const result = await customization(booking.id, type, `Queue item ${type}`);
    ids.push(
      result.bookingRequest.customizationRequests.find(
        (request: any) => request.description === `Queue item ${type}`,
      ).id,
    );
  }

  const firstPage = await read(
    await call("/admin/customization-requests?status=requested&limit=2", "GET", undefined, adminCookie),
    200,
  );
  assert.equal(firstPage.requests.length, 2);
  assert.ok(firstPage.nextCursor);
  for (const request of firstPage.requests) {
    assert.equal(request.status, "requested");
    assert.ok(request.bookingRequestReference);
    assert.ok(request.customerName);
    assert.equal(request.packageName, "Garden Wedding");
    assert.equal(request.eventType, "Wedding");
    assert.equal(request.requestedByName, "Customer One");
  }
  const secondPage = await read(
    await call(`/admin/customization-requests?status=requested&limit=2&cursor=${firstPage.nextCursor}`, "GET", undefined, adminCookie),
    200,
  );
  const seen = [...firstPage.requests, ...secondPage.requests].map((request: any) => request.id);
  assert.equal(new Set(seen).size, seen.length);
  assert.ok(ids.every((id) => seen.includes(id)));

  await read(await call(`/admin/customization-requests/${ids[0]}`, "PATCH", { decision: "approved" }, adminCookie), 200);
  const stillRequested = await read(
    await call("/admin/customization-requests?status=requested", "GET", undefined, adminCookie),
    200,
  );
  assert.ok(!stillRequested.requests.some((request: any) => request.id === ids[0]));
  const approved = await read(
    await call("/admin/customization-requests?status=approved", "GET", undefined, adminCookie),
    200,
  );
  assert.ok(approved.requests.some((request: any) => request.id === ids[0]));
  await read(await call("/admin/customization-requests?status=not_a_status", "GET", undefined, adminCookie), 400);
  await read(await call("/admin/customization-requests?limit=51", "GET", undefined, adminCookie), 400);

  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/booking-requests/{id}/customization-requests"].post);
  assert.ok(spec.paths["/v1/customization-requests/{id}/withdraw"].patch);
  assert.ok(spec.paths["/v1/admin/customization-requests"].get);
  assert.ok(spec.paths["/v1/admin/customization-requests/{id}"].patch);
  assert.ok(spec.paths["/v1/admin/booking-requests/{id}/arrangement"].patch);
});

test("pending customization requests keep a finished event conversation open", async () => {
  const booking = await createBooking();
  const conversation = await db
    .selectFrom("conversations")
    .selectAll()
    .where("booking_request_id", "=", booking.id)
    .executeTakeFirstOrThrow();
  const endsAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const startsAt = new Date(endsAt.getTime() - 60 * 60 * 1000);
  await read(
    await call(`/admin/booking-requests/${booking.id}/arrangement`, "PATCH", {
      expectedUpdatedAt: booking.arrangement.updatedAt,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }, adminCookie),
    200,
  );

  const submitted = await customization(booking.id, "add_event_hours", "One more hour");
  const pending = submitted.bookingRequest.customizationRequests.find(
    (request: any) => request.description === "One more hour",
  );
  const keptOpen = await read(
    await call("/messages/conversations/" + conversation.id, "GET", undefined, customerCookie),
    200,
  );
  assert.equal(keptOpen.conversation.status, "active");
  assert.equal(keptOpen.conversation.expiresAt, null);
  assert.equal(keptOpen.conversation.eventEndsAt, endsAt.toISOString());

  // A finished booking without pending requests still closes on the next read.
  const finished = await createBooking();
  const finishedConversation = await db
    .selectFrom("conversations")
    .selectAll()
    .where("booking_request_id", "=", finished.id)
    .executeTakeFirstOrThrow();
  await read(
    await call(`/admin/booking-requests/${finished.id}/arrangement`, "PATCH", {
      expectedUpdatedAt: finished.arrangement.updatedAt,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }, adminCookie),
    200,
  );
  const closedOnRead = await read(
    await call("/messages/conversations/" + finishedConversation.id, "GET", undefined, customerCookie),
    200,
  );
  assert.equal(closedOnRead.conversation.status, "closed");
  assert.equal(
    closedOnRead.conversation.expiresAt,
    new Date(endsAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  );

  await read(await call(`/customization-requests/${pending.id}/withdraw`, "PATCH", undefined, customerCookie), 200);
  const closedAgain = await read(
    await call("/messages/conversations/" + conversation.id, "GET", undefined, customerCookie),
    200,
  );
  assert.equal(closedAgain.conversation.status, "closed");
  assert.equal(closedAgain.conversation.expiresAt, new Date(endsAt.getTime() + 24 * 60 * 60 * 1000).toISOString());
  assert.equal(closedAgain.conversation.customerId, customerId);
  assert.equal(closedAgain.conversation.eventEndsAt, endsAt.toISOString());
});
