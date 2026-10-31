import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
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

test("requests enforce roles, version availability, ownership and status history", async () => {
  const pkg = await db.insertInto("packages").defaultValues().returningAll().executeTakeFirstOrThrow();
  const version = await db.insertInto("package_versions").values({ package_id:pkg.id, version:1, state:"published", name:"Garden", event_types:["Wedding"], description:"Details", guest_min:30, guest_max:100, venue_details:"Venue", inclusions:[], exclusions:[], terms:"Terms", published_at:new Date(), price_amount_minor:100 }).returningAll().executeTakeFirstOrThrow();
  const input = {packageId:pkg.id,packageVersionId:version.id,eventType:"Wedding",preferredDate:"2099-01-02",estimatedDuration:"8_hours",timeZone:"Asia/Manila",guestCount:120,contactName:"Customer",phoneNumber:"123",specialRequests:"Music"};
  await read(await call("/booking-requests","POST",input),401);
  await read(await call("/booking-requests","POST",input,adminCookie),403);
  await read(await call("/admin/booking-requests","GET",undefined,customerCookie),403);
  for (const preferredDate of ["2020-01-01", "2027-02-29", "0000-01-01", "2099-13-01", "01-02-2099"])
    await read(await call("/booking-requests","POST",{...input,preferredDate},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,estimatedDuration:"3_hours"},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,contactName:" "},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,timeZone:"Wrong/Zone"},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,packageVersionId:randomUUID()},customerCookie),409);
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
  assert.equal(created.startsAt, null); assert.equal(created.endsAt, null); assert.equal(created.preferredVenueLocation, null);
  assert.equal(created.customerId,customerId); assert.equal(created.outOfRange,true); assert.equal(created.status,"under_review"); assert.equal(created.statusHistory.length,1);
  const linkedConversation = await db.selectFrom("conversations").selectAll().where("booking_request_id", "=", created.id).executeTakeFirst();
  assert.ok(linkedConversation);
  assert.equal(linkedConversation.customer_id, customerId);
  assert.equal(linkedConversation.event_starts_at, null);
  assert.equal(linkedConversation.event_ends_at, null);
  assert.equal(linkedConversation.status, "active");
  assert.deepEqual((await read(await call("/booking-requests/mine","GET",undefined,otherCustomerCookie),200)).bookingRequests,[]);
  assert.equal((await read(await call("/booking-requests/mine","GET",undefined,customerCookie),200)).bookingRequests[0].id,created.id);
  const staffRequests = (await read(await call("/admin/booking-requests", "GET", undefined, staffCookie), 200)).bookingRequests;
  assert.ok(staffRequests.some((row: any) => row.id === created.id));
  const legacy = staffRequests.find((row: any) => row.reference === "LEGACY");
  assert.equal(legacy.preferredDate, "2027-01-02"); assert.equal(legacy.estimatedDuration, "undecided");
  assert.equal(legacy.startsAt, "2027-01-01T16:30:00.000Z"); assert.equal(legacy.preferredVenueLocation, "Manila");
  await read(await call(`/admin/booking-requests/${created.id}/status`, "PATCH", {status:"accepted"}, staffCookie), 403);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"confirmed"},adminCookie),400);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"accepted"},customerCookie),403);
  const updated = (await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"needs_details",reason:"Please clarify"},adminCookie),200)).bookingRequest;
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
  await db.updateTable("package_versions").set({state:"superseded"}).where("id","=",version.id).execute();
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  await db.updateTable("packages").set({archived_at:new Date()}).where("id","=",pkg.id).execute();
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  const list = (await read(await call("/admin/booking-requests","GET",undefined,adminCookie),200)).bookingRequests;
  const original = list.find((item: any) => item.id === created.id);
  assert.equal(original.packageName,"Garden"); assert.equal(original.packageVersionId,version.id); assert.equal(original.statusHistory.length,3);
  const spec:any = await (await app.request("/openapi.json")).json();
  const requestSchema = spec.paths["/v1/booking-requests"].post.requestBody.content["application/json"].schema;
  assert.ok(requestSchema.required.includes("preferredDate"));
  assert.ok(!requestSchema.required.includes("startsAt"));
  assert.ok(spec.paths["/v1/booking-requests"].post); assert.ok(spec.paths["/v1/booking-requests/{id}/cancel"].patch); assert.ok(spec.paths["/v1/admin/booking-requests/{id}/status"].patch);
});

test("admin request filters, cursor pages and calendar counts use preferred dates", async () => {
  const legacy = await pool.query("SELECT * FROM booking_requests WHERE reference = 'LEGACY'");
  const fixture = legacy.rows[0];
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()].sort().reverse();
  const rows = [
    [ids[0], "2098-02-02", "under_review"], [ids[1], "2098-02-02", "under_review"],
    [ids[2], "2098-02-03", "under_review"], [ids[3], "2098-02-02", "accepted"],
    [ids[4], "2098-03-01", "under_review"],
  ];
  for (const [id, date, status] of rows) {
    await pool.query(`INSERT INTO booking_requests (id, reference, customer_id, package_id, package_version_id, package_name, event_type, preferred_date, estimated_duration, time_zone, guest_count, contact_name, phone_number, status, out_of_range, created_at)
      VALUES ($1, $2, $3, $4, $5, 'Fixture', 'Wedding', $6, 'undecided', 'Asia/Manila', 20, 'Customer', '123', $7, false, '2098-01-01T00:00:00.123456Z')`, [id, `TEST-${id}`, fixture.customer_id, fixture.package_id, fixture.package_version_id, date, status]);
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
  const fixture = (await pool.query("SELECT customer_id, package_id, package_version_id FROM booking_requests WHERE reference = 'LEGACY'")).rows[0];
  await pool.query(`INSERT INTO booking_requests (reference, customer_id, package_id, package_version_id, package_name, event_type, preferred_date, estimated_duration, time_zone, guest_count, contact_name, phone_number, status, out_of_range, created_at)
    SELECT 'PAGE-' || n, $1, $2, $3, 'Fixture', 'Wedding', '2097-05-10', 'undecided', 'Asia/Manila', 20, 'Customer', '123', 'under_review', false,
      '2097-01-01T00:00:00.123456Z'::timestamptz + (n / 4) * interval '1 second'
    FROM generate_series(1, 53) AS n`, [fixture.customer_id, fixture.package_id, fixture.package_version_id]);
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
