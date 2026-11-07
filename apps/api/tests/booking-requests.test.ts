import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { dropTestDatabase } from "./helpers/drop-test-database.js";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_booking_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let staffCookie: string;
let customerCookie: string;
let otherCustomerCookie: string;
let customerId: string;
let otherCustomerId: string;
let resetBookingConversationId: string | undefined;
let preservedGeneralConversationId: string | undefined;

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
    if (entry.name === "20261030100000_designate_existing_admins") {
      await pool.query("INSERT INTO users (email, role, staff_role, password_hash) VALUES ('old-admin@example.test', 'admin', NULL, 'unused'), ('old-staff@example.test', 'admin', 'Waiter', 'unused')");
    }
    if (entry.name === "20261101100000_short_booking_intake") {
      const user = await pool.query("INSERT INTO users (email, role, password_hash) VALUES ('legacy-booker@example.test', 'customer', 'unused') RETURNING id");
      const pkg = await pool.query("INSERT INTO packages DEFAULT VALUES RETURNING id");
      const version = await pool.query(`INSERT INTO package_versions (package_id, version, state, name, event_types, description, guest_min, guest_max, venue_details, inclusions, exclusions, terms, published_at, price_amount_minor)
        VALUES ($1, 1, 'published', 'Legacy', ARRAY['Wedding'], 'Details', 30, 100, 'Venue', ARRAY[]::text[], ARRAY[]::text[], 'Terms', now(), 100) RETURNING id`, [pkg.rows[0].id]);
      await pool.query(`INSERT INTO booking_requests (reference, customer_id, package_id, package_version_id, package_name, event_type, starts_at, ends_at, time_zone, guest_count, contact_name, phone_number, preferred_venue_location, out_of_range)
        VALUES ('LEGACY', $1, $2, $3, 'Legacy', 'Wedding', '2027-01-01T16:30:00Z', '2027-01-01T20:30:00Z', 'Asia/Manila', 10, 'Legacy Customer', '123', 'Manila', false)`, [user.rows[0].id, pkg.rows[0].id, version.rows[0].id]);
    }
    if (entry.name === "20261102130000_package_canvas") {
      const legacy = await pool.query("SELECT id, customer_id FROM booking_requests WHERE reference = 'LEGACY'");
      assert.equal(legacy.rowCount, 1);
      resetBookingConversationId = (await pool.query(
        "INSERT INTO conversations (customer_id, booking_request_id) VALUES ($1, $2) RETURNING id",
        [legacy.rows[0].customer_id, legacy.rows[0].id],
      )).rows[0].id;
      await pool.query(
        "INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, $2, 'customer', 'Old booking transcript')",
        [resetBookingConversationId, legacy.rows[0].customer_id],
      );
      preservedGeneralConversationId = (await pool.query(
        "INSERT INTO conversations (customer_id) VALUES ($1) RETURNING id",
        [legacy.rows[0].customer_id],
      )).rows[0].id;
      await pool.query(
        "INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, $2, 'customer', 'Keep general transcript')",
        [preservedGeneralConversationId, legacy.rows[0].customer_id],
      );
    }
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
    if (entry.name === "20261101100000_short_booking_intake") {
      const legacy = await pool.query("SELECT preferred_date, estimated_duration, starts_at, ends_at, preferred_venue_location FROM booking_requests WHERE reference = 'LEGACY'");
      assert.equal(legacy.rows[0].preferred_date, "2027-01-02");
      assert.equal(legacy.rows[0].estimated_duration, "undecided");
      assert.equal(legacy.rows[0].starts_at.toISOString(), "2027-01-01T16:30:00.000Z");
      assert.equal(legacy.rows[0].ends_at.toISOString(), "2027-01-01T20:30:00.000Z");
      assert.equal(legacy.rows[0].preferred_venue_location, "Manila");
    }
    if (entry.name === "20261030100000_designate_existing_admins") {
      const migrated = await pool.query("SELECT email, role, staff_role FROM users WHERE email IN ('old-admin@example.test', 'old-staff@example.test') ORDER BY email");
      assert.deepEqual(migrated.rows, [
        { email: "old-admin@example.test", role: "admin", staff_role: "System Administrator" },
        { email: "old-staff@example.test", role: "staff", staff_role: "Waiter" },
      ]);
    }
    if (entry.name === "20261102130000_package_canvas") {
      assert.equal((await pool.query("SELECT id FROM booking_requests WHERE reference = 'LEGACY'")).rowCount, 0);
      assert.equal((await pool.query("SELECT id FROM conversations WHERE id = $1", [resetBookingConversationId])).rowCount, 0);
      assert.equal((await pool.query("SELECT id FROM messages WHERE conversation_id = $1", [resetBookingConversationId])).rowCount, 0);
      assert.equal((await pool.query("SELECT id FROM conversations WHERE id = $1", [preservedGeneralConversationId])).rowCount, 1);
      assert.deepEqual(
        (await pool.query("SELECT body FROM messages WHERE conversation_id = $1", [preservedGeneralConversationId])).rows,
        [{ body: "Keep general transcript" }],
      );
    }
  }
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));

  async function session(role: string, name: string) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({ email: `${role}-${randomUUID()}@example.test`, display_name: name, password_hash: "unused", role, staff_role: role === "admin" ? "System Administrator" : null })
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
  otherCustomerId = other.id;
});

after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) {
    try {
      await dropTestDatabase(admin, database);
    } finally {
      await admin.end();
    }
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

test("requests enforce roles, published package availability, live package data, ownership and status history", async () => {
  const pkg = await db.insertInto("packages").values({
    name: "Garden",
    max_guests: 100,
    price: 150_000,
  }).returningAll().executeTakeFirstOrThrow();
  const service = await db.insertInto("services").values({ name: "Photography", description: "Event photography" }).returningAll().executeTakeFirstOrThrow();
  await db.insertInto("package_services").values({ package_id: pkg.id, service_id: service.id, role: "included", sort_order: 0 }).execute();
  let input = {packageId:pkg.id,packageUpdatedAt:pkg.updated_at.toISOString(),eventType:"Wedding",preferredDate:"2099-01-02",estimatedDuration:"8_hours",guestCount:120,contactName:"Customer",phoneNumber:"123",preferredVenueLocation:"Garden Hall",specialRequests:"Music"};
  await read(await call("/booking-requests","POST",input),401);
  await read(await call("/booking-requests","POST",input,adminCookie),403);
  await read(await call("/admin/booking-requests","GET",undefined,customerCookie),403);
  for (const preferredDate of ["2020-01-01", "2027-02-29", "0000-01-01", "2099-13-01", "01-02-2099"])
    await read(await call("/booking-requests","POST",{...input,preferredDate},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,estimatedDuration:"3_hours"},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,contactName:" "},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,preferredVenueLocation:"x".repeat(1001)},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,guestCount:null},customerCookie),201);
  await read(await call("/booking-requests","POST",{...input,timeZone:"Wrong/Zone"},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,packageId:randomUUID()},customerCookie),409);
  await read(await call("/booking-requests","POST",{...input,packageUpdatedAt:"2000-01-01T00:00:00.000Z"},customerCookie),409);
  const { packageUpdatedAt: _packageUpdatedAt, ...withoutPackageUpdatedAt } = input;
  const withoutTimestamp = (await read(await call("/booking-requests","POST",withoutPackageUpdatedAt,customerCookie),201)).bookingRequest;
  assert.equal(withoutTimestamp.packageName, "Garden");
  assert.deepEqual(withoutTimestamp.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 15_000_000 });
  assert.equal(withoutTimestamp.packageMaxGuests, 100);
  const staffProfile = await read(await call("/me", "GET", undefined, staffCookie), 200);
  assert.equal(staffProfile.role, "staff");
  for (const path of ["/admin/users", "/admin/conversations", "/admin/packages", "/admin/services"])
    await read(await call(path, "GET", undefined, staffCookie), 403);
  for (const path of ["/admin/packages", "/admin/services", "/admin/conversations", "/messages/conversation", "/booking-requests"])
    await read(await call(path, "POST", {}, staffCookie), 403);
  await read(await call("/messages/conversation", "GET", undefined, staffCookie), 403);
  await read(await call(`/admin/packages/${pkg.id}`, "GET", undefined, staffCookie), 403);
  await read(await call(`/admin/services/${randomUUID()}`, "GET", undefined, staffCookie), 403);
  await read(await call("/packages", "GET", undefined, staffCookie), 200);
  await read(await call("/services", "GET", undefined, staffCookie), 200);
  const created = (await read(await call("/booking-requests","POST",input,customerCookie),201)).bookingRequest;
  assert.equal(created.preferredDate, input.preferredDate); assert.equal(created.estimatedDuration, "8_hours");
  assert.equal(created.packageName, "Garden");
  assert.equal(created.guestCount, 120);
  assert.equal(created.preferredVenueLocation, "Garden Hall");
  assert.deepEqual(created.packageInclusions, [{ serviceId: service.id, name: "Photography", role: "included", sortOrder: 0 }]);
  assert.deepEqual(created.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 15_000_000 });
  assert.equal(created.packageMaxGuests, 100);
  assert.equal("packageVersionId" in created, false);
  const atMaximum = (await read(await call("/booking-requests", "POST", { ...input, guestCount: 100 }, customerCookie), 201)).bookingRequest;
  const belowPreviousMinimum = (await read(await call("/booking-requests", "POST", { ...input, guestCount: 1 }, customerCookie), 201)).bookingRequest;
  assert.equal(atMaximum.outOfRange, false);
  assert.equal(belowPreviousMinimum.outOfRange, false);
  const { guestCount: _guestCount, ...withoutGuestCount } = input;
  for (const estimatedDuration of ["3_days", "4_days", "5_days", "6_days", "1_week", "more_than_1_week"]) {
    const estimatedDurationDays = estimatedDuration === "more_than_1_week" ? 8 : null;
    const request = (await read(await call("/booking-requests", "POST", { ...withoutGuestCount, estimatedDuration, ...(estimatedDurationDays === null ? {} : { estimatedDurationDays }) }, customerCookie), 201)).bookingRequest;
    assert.equal(request.estimatedDuration, estimatedDuration);
    assert.equal(request.estimatedDurationDays, estimatedDurationDays);
    assert.equal(request.guestCount, null);
    assert.equal(request.outOfRange, false);
    const saved = await pool.query("SELECT estimated_duration, estimated_duration_days, guest_count, out_of_range FROM booking_requests WHERE id = $1", [request.id]);
    assert.deepEqual(saved.rows[0], { estimated_duration: estimatedDuration, estimated_duration_days: estimatedDurationDays, guest_count: null, out_of_range: false });
    const fetched = (await read(await call(`/booking-requests/${request.id}`, "GET", undefined, customerCookie), 200)).bookingRequest;
    assert.equal(fetched.estimatedDuration, estimatedDuration);
    assert.equal(fetched.estimatedDurationDays, estimatedDurationDays);
    assert.equal(fetched.guestCount, null);
    assert.equal(fetched.outOfRange, false);
  }
  for (const estimatedDurationDays of [undefined, 7, 8.5]) {
    await read(await call("/booking-requests", "POST", { ...input, estimatedDuration: "more_than_1_week", estimatedDurationDays }, customerCookie), 400);
  }
  for (const estimatedDuration of ["4_hours", "8_hours", "12_hours", "1_day", "2_days", "3_days", "4_days", "5_days", "6_days", "1_week", "undecided"]) {
    await read(await call("/booking-requests", "POST", { ...input, estimatedDuration, estimatedDurationDays: 8 }, customerCookie), 400);
  }
  const detail = (await read(await call(`/booking-requests/${created.id}`, "GET", undefined, customerCookie), 200)).bookingRequest;
  assert.deepEqual(detail, created);
  for (const cookie of [adminCookie, staffCookie]) {
    assert.deepEqual((await read(await call(`/admin/booking-requests/${created.id}`, "GET", undefined, cookie), 200)).bookingRequest, created);
  }
  await read(await call(`/booking-requests/${created.id}`, "GET"), 401);
  await read(await call(`/booking-requests/${created.id}`, "GET", undefined, otherCustomerCookie), 404);
  await read(await call(`/booking-requests/${created.id}`, "GET", undefined, adminCookie), 403);
  await read(await call(`/admin/booking-requests/${created.id}`, "GET", undefined, customerCookie), 403);
  await read(await call(`/booking-requests/${randomUUID()}`, "GET", undefined, customerCookie), 404);
  await read(await call(`/admin/booking-requests/${randomUUID()}`, "GET", undefined, adminCookie), 404);
  await read(await call(`/booking-requests/invalid`, "GET", undefined, customerCookie), 400);
  assert.equal(created.startsAt, null); assert.equal(created.endsAt, null);
  assert.equal(created.customerId,customerId); assert.equal(created.outOfRange,true); assert.equal(created.status,"under_review"); assert.equal(created.statusHistory.length,1);
  const linkedConversation = await db.selectFrom("conversations").selectAll().where("booking_request_id", "=", created.id).executeTakeFirst();
  assert.ok(linkedConversation);
  assert.equal(linkedConversation.customer_id, customerId);
  assert.equal(linkedConversation.status, "active");
  assert.equal("event_starts_at" in linkedConversation, false);
  assert.equal("event_ends_at" in linkedConversation, false);
  assert.equal("guest_count" in linkedConversation, false);
  const linkedAdminConversation = (await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200)).conversations.find((conversation: any) => conversation.bookingRequestId === created.id);
  assert.ok(linkedAdminConversation);
  assert.equal(linkedAdminConversation.packageId, pkg.id);
  assert.equal(linkedAdminConversation.packageName, "Garden");
  assert.equal(linkedAdminConversation.eventType, "Wedding");
  assert.equal(linkedAdminConversation.guestCount, 120);
  assert.equal(linkedAdminConversation.eventStartsAt, null);
  assert.equal(linkedAdminConversation.eventEndsAt, null);
  assert.deepEqual((await read(await call("/booking-requests/mine","GET",undefined,otherCustomerCookie),200)).bookingRequests,[]);
  assert.ok((await read(await call("/booking-requests/mine","GET",undefined,customerCookie),200)).bookingRequests.some((request: any) => request.id === created.id));
  const staffRequests = (await read(await call("/admin/booking-requests", "GET", undefined, staffCookie), 200)).bookingRequests;
  assert.ok(staffRequests.some((row: any) => row.id === created.id));
  assert.ok(!staffRequests.some((row: any) => row.reference === "LEGACY"));
  await read(await call(`/admin/booking-requests/${created.id}/status`, "PATCH", {status:"accepted"}, staffCookie), 403);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"confirmed"},adminCookie),400);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"accepted"},customerCookie),403);
  const updated = (await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"needs_details",reason:"Please clarify"},adminCookie),200)).bookingRequest;
  assert.deepEqual((await read(await call(`/booking-requests/${created.id}`, "GET", undefined, customerCookie), 200)).bookingRequest.statusHistory, updated.statusHistory);
  assert.equal(updated.status,"needs_details"); assert.equal(updated.statusHistory[1].reason,"Please clarify");
  for (const status of ["needs_details", "declined", "cancelled"]) await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status, reason:"  "},adminCookie),400);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"declined", reason:"Unavailable"},adminCookie),200);
  await read(await call(`/booking-requests/${created.id}/cancel`,"PATCH",{reason:"Change of plans"},customerCookie),409);
  const { estimatedDuration: _duration, ...withoutDuration } = input;
  const another = (await read(await call("/booking-requests","POST",withoutDuration,customerCookie),201)).bookingRequest;
  assert.equal(another.estimatedDuration, "undecided");
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},otherCustomerCookie),404);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},adminCookie),403);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"}),401);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{},customerCookie),400);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"  "},customerCookie),400);
  await read(await call(`/admin/booking-requests/${another.id}/status`,"PATCH",{status:"accepted"},adminCookie),200);
  const cancelled = (await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},customerCookie),200)).bookingRequest;
  assert.equal(cancelled.status,"cancelled"); assert.equal(cancelled.statusHistory.at(-1).reason,"Change of plans"); assert.equal(cancelled.statusHistory.at(-1).changedBy,customerId);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},customerCookie),409);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"accepted"},adminCookie),409);
  const todayInManila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayRequest = (await read(await call("/booking-requests", "POST", { ...input, preferredDate: todayInManila, estimatedDuration: "1_day" }, customerCookie), 201)).bookingRequest;
  assert.equal(todayRequest.preferredDate, todayInManila); assert.equal(todayRequest.estimatedDuration, "1_day");
  const updatedPackage = await db.updateTable("packages").set({
    name: "Updated Garden",
    max_guests: 200,
    price: 200_000,
    updated_at: new Date(),
  }).where("id", "=", pkg.id).returningAll().executeTakeFirstOrThrow();
  await db.updateTable("services").set({ name: "Renamed Photography" }).where("id", "=", service.id).execute();
  const currentPackageDetails = (await read(await call(`/booking-requests/${created.id}`, "GET", undefined, customerCookie), 200)).bookingRequest;
  assert.equal(currentPackageDetails.packageName, "Updated Garden");
  assert.deepEqual(currentPackageDetails.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 20_000_000 });
  assert.equal(currentPackageDetails.packageMaxGuests, 200);
  assert.deepEqual(currentPackageDetails.packageInclusions, [{ serviceId: service.id, name: "Renamed Photography", role: "included", sortOrder: 0 }]);
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  input = { ...input, packageUpdatedAt: updatedPackage.updated_at.toISOString() };
  await db.updateTable("packages").set({archived_at:new Date()}).where("id","=",pkg.id).execute();
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  const list = (await read(await call("/admin/booking-requests","GET",undefined,adminCookie),200)).bookingRequests;
  const original = list.find((item: any) => item.id === created.id);
  assert.equal(original.packageName,"Updated Garden");
  assert.deepEqual(original.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 20_000_000 });
  assert.equal(original.packageMaxGuests, 200);
  assert.equal("packageVersionId" in original, false);
  assert.equal(original.statusHistory.length,3);
  const spec:any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/booking-requests/{id}"].get);
  assert.ok(spec.paths["/v1/admin/booking-requests/{id}"].get);
  const requestSchema = spec.paths["/v1/booking-requests"].post.requestBody.content["application/json"].schema;
  assert.ok(requestSchema.required.includes("preferredDate"));
  assert.ok(!requestSchema.required.includes("guestCount"));
  assert.ok(!requestSchema.required.includes("startsAt"));
  assert.ok(!("packageVersionId" in requestSchema.properties));
  assert.ok("packageUpdatedAt" in requestSchema.properties);
  assert.ok(spec.paths["/v1/booking-requests"].post); assert.ok(spec.paths["/v1/booking-requests/{id}/cancel"].patch); assert.ok(spec.paths["/v1/admin/booking-requests/{id}/status"].patch);
});

test("admin request filters, cursor pages and calendar counts use preferred dates", async () => {
  const packageId = (await pool.query(
    "INSERT INTO packages (name, max_guests, price) VALUES ('Filter fixture', 100, 1000) RETURNING id",
  )).rows[0].id;
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()].sort().reverse();
  const rows = [
    [ids[0], "2098-02-02", "under_review"], [ids[1], "2098-02-02", "under_review"],
    [ids[2], "2098-02-03", "under_review"], [ids[3], "2098-02-02", "accepted"],
    [ids[4], "2098-03-01", "under_review"],
  ];
  for (const [id, date, status] of rows) {
    await pool.query(`INSERT INTO booking_requests (id, reference, customer_id, package_id, event_type, preferred_date, estimated_duration, guest_count, contact_name, phone_number, status, out_of_range, created_at)
      VALUES ($1, $2, $3, $4, 'Wedding', $5, 'undecided', 20, 'Customer', '123', $6, false, '2098-01-01T00:00:00.123456Z')`, [id, `TEST-${id}`, customerId, packageId, date, status]);
  }
  const base = "/admin/booking-requests?status=under_review&preferredDate=2098-02-02&limit=1";
  const first = await read(await call(base, "GET", undefined, adminCookie), 200);
  const second = await read(await call(`${base}&cursor=${first.nextCursor}`, "GET", undefined, adminCookie), 200);
  assert.deepEqual([first.bookingRequests[0].id, second.bookingRequests[0].id], ids.slice(0, 2));
  assert.equal(second.nextCursor, null);
  const calendar = await read(await call("/admin/booking-requests/calendar?month=2098-02&status=under_review", "GET", undefined, staffCookie), 200);
  assert.deepEqual(calendar.dailyCounts, [{preferredDate:"2098-02-02",count:2},{preferredDate:"2098-02-03",count:1}]);
  const all = await read(await call("/admin/booking-requests/calendar?month=2098-02", "GET", undefined, adminCookie), 200);
  assert.deepEqual(all.dailyCounts, [{preferredDate:"2098-02-02",count:3},{preferredDate:"2098-02-03",count:1}]);
  for (const path of ["/admin/booking-requests?limit=51", "/admin/booking-requests?status=unknown", "/admin/booking-requests?preferredDate=2098-02-30", "/admin/booking-requests?cursor=bad", "/admin/booking-requests/calendar?month=2098-13"]) await read(await call(path,"GET",undefined,adminCookie),400);
  await read(await call("/admin/booking-requests/calendar?month=2098-02", "GET", undefined, customerCookie), 403);
  const spec:any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/booking-requests/calendar"].get);
});

test("booking request pagination crosses the 50-item boundary without duplicates", async () => {
  const packageId = (await pool.query(
    "INSERT INTO packages (name, max_guests, price) VALUES ('Pagination fixture', 100, 1000) RETURNING id",
  )).rows[0].id;
  await pool.query(`INSERT INTO booking_requests (reference, customer_id, package_id, event_type, preferred_date, estimated_duration, guest_count, contact_name, phone_number, status, out_of_range, created_at)
    SELECT 'PAGE-' || n, $1, $2, 'Wedding', '2097-05-10', 'undecided', 20, 'Customer', '123', 'under_review', false,
      '2097-01-01T00:00:00.123456Z'::timestamptz + (n / 4) * interval '1 second'
    FROM generate_series(1, 53) AS n`, [customerId, packageId]);
  const expected = (await pool.query("SELECT id FROM booking_requests WHERE preferred_date = '2097-05-10' AND status = 'under_review' ORDER BY created_at DESC, id DESC")).rows.map(row => row.id);
  const base = "/admin/booking-requests?status=under_review&preferredDate=2097-05-10&limit=50";
  const first = await read(await call(base, "GET", undefined, adminCookie), 200);
  assert.equal(first.bookingRequests.length, 50);
  assert.ok(first.nextCursor);
  const second = await read(await call(`${base}&cursor=${first.nextCursor}`, "GET", undefined, adminCookie), 200);
  assert.equal(second.bookingRequests.length, 3);
  assert.equal(second.nextCursor, null);
  const actual = [...first.bookingRequests, ...second.bookingRequests].map((row: any) => row.id);
  assert.equal(new Set(actual).size, 53);
  assert.deepEqual(actual, expected);
});


test("admin edits direct details with concurrency, privacy, calendar and message context", async () => {
  const pkg = await db.insertInto("packages").values({ name: "Details fixture", max_guests: 100, price: 2000 }).returningAll().executeTakeFirstOrThrow();
  const created = (await read(await call("/booking-requests", "POST", { packageId: pkg.id, eventType: "Wedding", preferredDate: "2099-06-01", contactName: "Customer", phoneNumber: "123" }, customerCookie), 201)).bookingRequest;
  const path = `/admin/booking-requests/${created.id}/details`;
  const changes = { expectedUpdatedAt: created.updatedAt, eventType: "Reception", preferredDate: "2099-06-02", startsAt: "2099-06-02T08:00:00.000Z", endsAt: "2099-06-02T12:00:00.000Z", guestCount: 120, notes: "Internal note" };
  await read(await call(path, "PATCH", changes, staffCookie), 403);
  await read(await call(path, "PATCH", changes, customerCookie), 403);
  await read(await call(path, "PATCH", { eventType: "Reception" }, adminCookie), 400);
  const updated = (await read(await call(path, "PATCH", changes, adminCookie), 200)).bookingRequest;
  assert.equal(updated.notes, "Internal note");
  assert.equal(updated.updatedByName, "Admin Person");
  assert.equal(updated.outOfRange, true);
  assert.equal(updated.startsAt, changes.startsAt);
  await read(await call(path, "PATCH", changes, adminCookie), 409);
  const saved = await pool.query("SELECT event_type, preferred_date, guest_count, out_of_range, notes FROM booking_requests WHERE id = $1", [created.id]);
  assert.deepEqual(saved.rows[0], { event_type: "Reception", preferred_date: "2099-06-02", guest_count: 120, out_of_range: true, notes: "Internal note" });
  for (const [route, cookie] of [[`/booking-requests/${created.id}`, customerCookie], [`/admin/booking-requests/${created.id}`, staffCookie]] as const) {
    const result = (await read(await call(route, "GET", undefined, cookie), 200)).bookingRequest;
    assert.equal(result.notes, null);
    for (const field of ["timeZone", "arrangement", "customizationRequests", "pendingCustomizationRequests", "packageInclusionsSnapshot"]) assert.equal(field in result, false);
  }
  const calendar = await read(await call("/admin/booking-requests/calendar?month=2099-06", "GET", undefined, staffCookie), 200);
  assert.ok(calendar.dailyCounts.some((item: any) => item.preferredDate === "2099-06-02" && item.count >= 1));
  const linked = (await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200)).conversations.find((item: any) => item.bookingRequestId === created.id);
  assert.equal(linked.eventType, "Reception"); assert.equal(linked.eventStartsAt, changes.startsAt); assert.equal(linked.eventEndsAt, changes.endsAt); assert.equal(linked.guestCount, 120);
  await read(await call(`/admin/booking-requests/${created.id}/status`, "PATCH", { status: "accepted" }, adminCookie), 200);
  await read(await call(path, "PATCH", { expectedUpdatedAt: updated.updatedAt, eventType: "Stale" }, adminCookie), 409);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/booking-requests/{id}/details"].patch);
  assert.equal(spec.paths["/v1/admin/booking-requests/{id}/arrangement"], undefined);
  assert.equal(spec.paths["/v1/admin/customization-requests"], undefined);
  assert.equal((await call(`/admin/booking-requests/${created.id}/arrangement`, "PATCH", changes, adminCookie)).status, 404);
});


test("preferred date follows Manila across the UTC day boundary", async (t) => {
  const pkg = await db.insertInto("packages").values({ name: "Date fixture", max_guests: 100, price: 1000 }).returning("id").executeTakeFirstOrThrow();
  const input = { packageId: pkg.id, eventType: "Wedding", preferredDate: "2026-01-01", contactName: "Customer", phoneNumber: "123" };
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-01T16:00:00.000Z") });
  try {
    await read(await call("/booking-requests", "POST", input, customerCookie), 400);
    const result = (await read(await call("/booking-requests", "POST", { ...input, preferredDate: "2026-01-02" }, customerCookie), 201)).bookingRequest;
    assert.equal(result.preferredDate, "2026-01-02");
  } finally {
    t.mock.timers.reset();
  }
});
