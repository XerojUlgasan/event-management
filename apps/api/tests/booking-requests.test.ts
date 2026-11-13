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
let resetBookingConversationId: string | undefined;
let preservedGeneralConversationId: string | undefined;
let dayMigrationSnapshot: unknown;
let dayMigrationBookingId: string;

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
    if (entry.name === "20261111120000_booking_requested_days") {
      const user = (await pool.query("INSERT INTO users(email,role,password_hash) VALUES ('days-legacy@example.test','customer','unused') RETURNING id")).rows[0].id;
      const pkg = (await pool.query("INSERT INTO packages(slug,name,max_guests,price) VALUES ('days-legacy','Days legacy',100,1000) RETURNING id")).rows[0].id;
      dayMigrationBookingId = (await pool.query(`INSERT INTO booking_requests(reference,customer_id,package_id,package_name,package_price,package_max_guests,event_type,preferred_date,estimated_duration,estimated_duration_days,starts_at,ends_at,time_zone,contact_name,phone_number,status,out_of_range)
        VALUES ('DAYS-LEGACY',$1,$2,'Original snapshot',1000,100,'Wedding','2099-01-01','more_than_1_week',9,'2099-01-01T10:00:00Z','2099-01-01T12:00:00Z','Asia/Manila','Legacy','123','accepted',false) RETURNING id`,[user,pkg])).rows[0].id;
      await pool.query("INSERT INTO booking_request_status_history(booking_request_id,status,changed_by) VALUES ($1,'accepted',$2)",[dayMigrationBookingId,user]);
      const conversation=(await pool.query("INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id",[user,dayMigrationBookingId])).rows[0].id;
      await pool.query("INSERT INTO messages(conversation_id,sender_id,sender_role,body) VALUES($1,$2,'customer','Preserved transcript')",[conversation,user]);
      await pool.query("INSERT INTO events_day(booking_request_id,day,starts_at,ends_at) VALUES($1,'2099-01-01','2099-01-01T10:00:00Z','2099-01-01T12:00:00Z')",[dayMigrationBookingId]);
      dayMigrationSnapshot=(await pool.query("SELECT to_jsonb(br) AS booking, (SELECT jsonb_agg(h) FROM booking_request_status_history h WHERE h.booking_request_id=br.id) AS history, (SELECT jsonb_agg(d) FROM events_day d WHERE d.booking_request_id=br.id) AS days, (SELECT jsonb_agg(c) FROM conversations c WHERE c.booking_request_id=br.id) AS conversations FROM booking_requests br WHERE br.id=$1",[dayMigrationBookingId])).rows[0];
    }
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
    if (entry.name === "20261111120000_booking_requested_days") {
      const after=(await pool.query("SELECT to_jsonb(br)-'requested_days' AS booking, (SELECT jsonb_agg(h) FROM booking_request_status_history h WHERE h.booking_request_id=br.id) AS history, (SELECT jsonb_agg(d) FROM events_day d WHERE d.booking_request_id=br.id) AS days, (SELECT jsonb_agg(c) FROM conversations c WHERE c.booking_request_id=br.id) AS conversations FROM booking_requests br WHERE br.id=$1",[dayMigrationBookingId])).rows[0];
      assert.deepEqual(after,dayMigrationSnapshot);
      assert.equal((await pool.query("SELECT requested_days FROM booking_requests WHERE id=$1",[dayMigrationBookingId])).rows[0].requested_days,null);
    }
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

test("requests enforce roles, published package availability, snapshots, ownership and status history", async () => {
  const pkg = await db.insertInto("packages").values({
    name: "Garden",
    slug: "garden",
    max_guests: 100,
    price: 150_000,
  }).returningAll().executeTakeFirstOrThrow();
  let input = {packageId:pkg.id,packageUpdatedAt:pkg.updated_at.toISOString(),eventType:"Wedding",durationMode:"one_day",requestedDays:[{date:"2099-01-02"}],timeZone:"Asia/Manila",guestCount:120,contactName:"Customer",phoneNumber:"123",specialRequests:"Music"};
  await read(await call("/booking-requests","POST",input),401);
  await read(await call("/booking-requests","POST",input,adminCookie),403);
  await read(await call("/admin/booking-requests","GET",undefined,customerCookie),403);
  for (const preferredDate of ["2020-01-01", "2027-02-29", "0000-01-01", "2099-13-01", "01-02-2099"])
    await read(await call("/booking-requests","POST",{...input,requestedDays:[{date:preferredDate}]},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,estimatedDuration:"3_hours"},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,contactName:" "},customerCookie),400);
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
  assert.equal(created.preferredDate, input.requestedDays[0]!.date); assert.equal(created.estimatedDuration, "undecided");
  assert.deepEqual(created.requestedDays,[{date:"2099-01-02",startsAt:null,endsAt:null,operationalSchedule:null}]);
  assert.equal(created.durationMode,"one_day"); assert.equal(created.requestedDayCount,1);
  assert.equal(created.packageName, "Garden");
  assert.deepEqual(created.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 15_000_000 });
  assert.equal(created.packageMaxGuests, 100);
  assert.equal("packageVersionId" in created, false);
  assert.deepEqual(
    (await pool.query("SELECT package_price, package_max_guests FROM booking_requests WHERE id = $1", [created.id])).rows[0],
    { package_price: 150_000, package_max_guests: 100 },
  );
  const atMaximum = (await read(await call("/booking-requests", "POST", { ...input, guestCount: 100 }, customerCookie), 201)).bookingRequest;
  const belowPreviousMinimum = (await read(await call("/booking-requests", "POST", { ...input, guestCount: 1 }, customerCookie), 201)).bookingRequest;
  assert.equal(atMaximum.outOfRange, false);
  assert.equal(belowPreviousMinimum.outOfRange, false);
  const { guestCount: _guestCount, ...withoutGuestCount } = input;
  for (const requestedDays of [[], [{date:"2099-01-02"},{date:"2099-01-02"}]]) {
    await read(await call("/booking-requests", "POST", { ...input, requestedDays }, customerCookie), 400);
  }
  await read(await call("/booking-requests", "POST", { ...input, durationMode:"multi_day" }, customerCookie), 400);
  for (const forbidden of [{startsAt:"2099-01-02T00:00:00Z"}, {eventDayId:randomUUID()}]) {
    await read(await call("/booking-requests", "POST", { ...input, requestedDays:[{date:"2099-01-02",...forbidden}] }, customerCookie),400);
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
  assert.equal(created.startsAt, null); assert.equal(created.endsAt, null); assert.equal(created.preferredVenueLocation, null);
  assert.equal(created.customerId,customerId); assert.equal(created.outOfRange,true); assert.equal(created.status,"under_review"); assert.equal("statusHistory" in created, false); assert.equal((await read(await call(`/booking-requests/${created.id}/status-history`, "GET", undefined, customerCookie), 200)).history.length, 1);
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
  const customerHistory = (await read(await call(`/booking-requests/${created.id}/status-history`, "GET", undefined, customerCookie), 200)).history;
  assert.deepEqual(customerHistory, (await read(await call(`/admin/booking-requests/${created.id}/status-history`, "GET", undefined, adminCookie), 200)).history);
  assert.equal(updated.status,"needs_details"); assert.equal(customerHistory[1].reason,"Please clarify");
  for (const status of ["needs_details", "declined", "cancelled"]) await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status, reason:"  "},adminCookie),400);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"declined", reason:"Unavailable"},adminCookie),200);
  await read(await call(`/booking-requests/${created.id}/cancel`,"PATCH",{reason:"Change of plans"},customerCookie),409);
  const withoutDuration = input;
  const another = (await read(await call("/booking-requests","POST",withoutDuration,customerCookie),201)).bookingRequest;
  assert.equal(another.estimatedDuration, "undecided");
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},otherCustomerCookie),404);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},adminCookie),403);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"}),401);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{},customerCookie),400);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"  "},customerCookie),400);
  await read(await call(`/admin/booking-requests/${another.id}/status`,"PATCH",{status:"accepted"},adminCookie),200);
  const cancelled = (await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},customerCookie),200)).bookingRequest;
  assert.equal(cancelled.status,"cancelled");
  const cancelledHistory = (await read(await call(`/booking-requests/${another.id}/status-history`, "GET", undefined, customerCookie), 200)).history;
  assert.equal(cancelledHistory.at(-1).reason,"Change of plans"); assert.equal(cancelledHistory.at(-1).changedBy,customerId);
  await read(await call(`/booking-requests/${another.id}/cancel`,"PATCH",{reason:"Change of plans"},customerCookie),409);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"accepted"},adminCookie),409);
  const todayInManila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const todayRequest = (await read(await call("/booking-requests", "POST", { ...input, requestedDays:[{date:todayInManila}] }, customerCookie), 201)).bookingRequest;
  assert.equal(todayRequest.preferredDate, todayInManila); assert.equal(todayRequest.estimatedDuration, "undecided");
  const updatedPackage = await db.updateTable("packages").set({
    name: "Updated Garden",
    max_guests: 200,
    price: 200_000,
    updated_at: new Date(),
  }).where("id", "=", pkg.id).returningAll().executeTakeFirstOrThrow();
  const persistedSnapshot = (await read(await call(`/booking-requests/${created.id}`, "GET", undefined, customerCookie), 200)).bookingRequest;
  assert.equal(persistedSnapshot.packageName, "Garden");
  assert.deepEqual(persistedSnapshot.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 15_000_000 });
  assert.equal(persistedSnapshot.packageMaxGuests, 100);
  assert.deepEqual(
    (await pool.query("SELECT package_price, package_max_guests FROM booking_requests WHERE id = $1", [created.id])).rows[0],
    { package_price: 150_000, package_max_guests: 100 },
  );
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  input = { ...input, packageUpdatedAt: updatedPackage.updated_at.toISOString() };
  await db.updateTable("packages").set({archived_at:new Date()}).where("id","=",pkg.id).execute();
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  const list = (await read(await call("/admin/booking-requests","GET",undefined,adminCookie),200)).bookingRequests;
  const original = list.find((item: any) => item.id === created.id);
  assert.equal(original.packageName,"Garden");
  assert.deepEqual(original.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 15_000_000 });
  assert.equal(original.packageMaxGuests, 100);
  assert.equal("packageVersionId" in original, false);
  assert.equal("statusHistory" in original, false);
  assert.equal((await read(await call(`/admin/booking-requests/${created.id}/status-history`, "GET", undefined, adminCookie), 200)).history.length, 3);
  const spec:any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/booking-requests/{id}/status-history"].get);
  assert.ok(spec.paths["/v1/admin/booking-requests/{id}/status-history"].get);
  assert.ok(spec.paths["/v1/booking-requests/{id}"].get);
  assert.ok(spec.paths["/v1/booking-requests/{id}/requested-days/{date}/times"].patch);
  assert.ok(spec.paths["/v1/admin/booking-requests/{id}"].get);
  const requestSchema = spec.paths["/v1/booking-requests"].post.requestBody.content["application/json"].schema;
  assert.ok(requestSchema.required.includes("requestedDays"));
  assert.ok(!requestSchema.required.includes("guestCount"));
  assert.ok(!requestSchema.required.includes("startsAt"));
  assert.ok(!("packageVersionId" in requestSchema.properties));
  assert.ok("packageUpdatedAt" in requestSchema.properties);
  assert.ok(spec.paths["/v1/booking-requests"].post); assert.ok(spec.paths["/v1/booking-requests/{id}/cancel"].patch); assert.ok(spec.paths["/v1/admin/booking-requests/{id}/status"].patch);
});

test("admin request filters, cursor pages and calendar counts use preferred dates", async () => {
  const packageId = (await pool.query(
    "INSERT INTO packages (slug, name, max_guests, price) VALUES ('filter-fixture', 'Filter fixture', 100, 1000) RETURNING id",
  )).rows[0].id;
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()].sort().reverse();
  const rows = [
    [ids[0], "2098-02-02", "under_review"], [ids[1], "2098-02-02", "under_review"],
    [ids[2], "2098-02-03", "under_review"], [ids[3], "2098-02-02", "accepted"],
    [ids[4], "2098-03-01", "under_review"],
  ];
  for (const [id, date, status] of rows) {
    await pool.query(`INSERT INTO booking_requests (id, reference, customer_id, package_id, package_name, event_type, preferred_date, estimated_duration, time_zone, guest_count, contact_name, phone_number, status, out_of_range, package_price, package_max_guests, created_at)
      VALUES ($1, $2, $3, $4, 'Fixture', 'Wedding', $5, 'undecided', 'Asia/Manila', 20, 'Customer', '123', $6, false, 1000, 100, '2098-01-01T00:00:00.123456Z')`, [id, `TEST-${id}`, customerId, packageId, date, status]);
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
    "INSERT INTO packages (slug, name, max_guests, price) VALUES ('pagination-fixture', 'Pagination fixture', 100, 1000) RETURNING id",
  )).rows[0].id;
  await pool.query(`INSERT INTO booking_requests (reference, customer_id, package_id, package_name, event_type, preferred_date, estimated_duration, time_zone, guest_count, contact_name, phone_number, status, out_of_range, package_price, package_max_guests, created_at)
    SELECT 'PAGE-' || n, $1, $2, 'Fixture', 'Wedding', '2097-05-10', 'undecided', 'Asia/Manila', 20, 'Customer', '123', 'under_review', false, 1000, 100,
      '2097-01-01T00:00:00.123000Z'::timestamptz + (n / 4) * interval '1 microsecond'
    FROM generate_series(1, 53) AS n`, [customerId, packageId]);
  const expected = (await pool.query("SELECT id FROM booking_requests WHERE preferred_date = '2097-05-10' AND status = 'under_review' ORDER BY created_at DESC, id DESC")).rows.map(row => row.id);
  await pool.query(`UPDATE booking_requests SET requested_days='[{"date":"2097-05-11","startsAt":null,"endsAt":null},{"date":"2097-05-12","startsAt":null,"endsAt":null},{"date":"2097-05-12","startsAt":null,"endsAt":null}]'::jsonb WHERE preferred_date='2097-05-10'`);
  const base = "/admin/booking-requests?status=under_review&preferredDate=2097-05-12&limit=50";
  const first = await read(await call(base, "GET", undefined, adminCookie), 200);
  assert.equal(first.bookingRequests.length, 50);
  assert.ok(first.nextCursor);
  const second = await read(await call(`${base}&cursor=${first.nextCursor}`, "GET", undefined, adminCookie), 200);
  assert.equal(second.bookingRequests.length, 3);
  assert.equal(second.nextCursor, null);
  await read(await call(`/admin/booking-requests?status=accepted&cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, adminCookie), 400);
  await read(await call(`/booking-requests/mine?cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, customerCookie), 400);
  const mine = await read(await call("/booking-requests/mine?limit=1", "GET", undefined, customerCookie), 200);
  assert.ok(mine.nextCursor);
  await read(await call(`/booking-requests/mine?cursor=${encodeURIComponent(mine.nextCursor)}`, "GET", undefined, otherCustomerCookie), 400);
  const actual = [...first.bookingRequests, ...second.bookingRequests].map((row: any) => row.id);
  assert.equal(new Set(actual).size, 53);
  assert.deepEqual(actual, expected);
  await pool.query("DELETE FROM booking_requests WHERE id = $1", [first.bookingRequests.at(-1).id]);
  const afterDeletion = await read(await call(`${base}&cursor=${first.nextCursor}`, "GET", undefined, adminCookie), 200);
  assert.deepEqual(afterDeletion.bookingRequests.map((row: any) => row.id), second.bookingRequests.map((row: any) => row.id));
  const calendar=await read(await call("/admin/booking-requests/calendar?month=2097-05&status=under_review","GET",undefined,adminCookie),200);
  assert.deepEqual(calendar.dailyCounts,[{preferredDate:"2097-05-11",count:52},{preferredDate:"2097-05-12",count:52}]);
  const ignoredPreferred=await read(await call("/admin/booking-requests?preferredDate=2097-05-10","GET",undefined,adminCookie),200);
  assert.equal(ignoredPreferred.bookingRequests.length,0);
});

async function createDatesBooking(dates = ["2099-12-05", "2099-12-07", "2099-12-08"], timeZone = "Asia/Manila") {
  const pkg = await db.insertInto("packages").values({ slug:`dates-${randomUUID()}`, name:`Dates fixture ${randomUUID()}`, max_guests:100, price:1000 }).returning("id").executeTakeFirstOrThrow();
  return (await read(await call("/booking-requests", "POST", {
    packageId:pkg.id,eventType:"Wedding",durationMode:dates.length === 1 ? "one_day" : "multi_day",
    requestedDays:dates.map(date => ({date})),timeZone,contactName:"Customer",phoneNumber:"123",
  }, customerCookie),201)).bookingRequest;
}
test("status history is bounded, ordered, scoped, and authorized", async () => {
  const booking = await createDatesBooking(["2099-12-05"]);
  const other = await createDatesBooking(["2099-12-06"]);
  await pool.query(`INSERT INTO booking_request_status_history (booking_request_id, status, changed_by, reason, created_at)
    SELECT $1, 'needs_details', $2, 'History ' || n, '2050-01-01T00:00:00Z'::timestamptz + (n / 2) * interval '1 microsecond' FROM generate_series(1, 52) n`, [booking.id, customerId]);
  const expected = (await pool.query("SELECT id FROM booking_request_status_history WHERE booking_request_id=$1 ORDER BY created_at, id", [booking.id])).rows.map(row => row.id);
  const path = `/booking-requests/${booking.id}/status-history`;
  await read(await call(path), 401);
  await read(await call(path, "GET", undefined, otherCustomerCookie), 404);
  await read(await call(path, "GET", undefined, staffCookie), 403);
  await read(await call(`/admin/booking-requests/${booking.id}/status-history`, "GET", undefined, customerCookie), 403);
  await read(await call(`/booking-requests/${randomUUID()}/status-history`, "GET", undefined, customerCookie), 404);
  await read(await call(`${path}?limit=51`, "GET", undefined, customerCookie), 400);
  await read(await call(`${path}?cursor=invalid`, "GET", undefined, customerCookie), 400);
  const firstResponse = await call(path, "GET", undefined, customerCookie);
  assert.equal(firstResponse.headers.get("cache-control"), "private, no-store");
  const first = await read(firstResponse, 200);
  assert.equal(first.history.length, 15); assert.ok(first.nextCursor);
  const forged = JSON.parse(Buffer.from(first.nextCursor, "base64url").toString("utf8"));
  forged.position.createdAt = "0000-01-01T00:00:00.000001Z";
  const forgedCursor = Buffer.from(JSON.stringify(forged)).toString("base64url");
  await read(await call(`${path}?cursor=${forgedCursor}`, "GET", undefined, customerCookie), 400);
  const second = await read(await call(`${path}?limit=50&cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, customerCookie), 200);
  assert.equal(second.nextCursor, null);
  assert.deepEqual([...first.history, ...second.history].map((item: {id:string}) => item.id), expected);
  const staff = await read(await call(`/admin/booking-requests/${booking.id}/status-history?limit=50`, "GET", undefined, staffCookie), 200);
  assert.deepEqual(staff.history.map((item: {id:string}) => item.id), expected.slice(0, 50));
  await read(await call(`/booking-requests/${other.id}/status-history?cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, customerCookie), 400);
  await read(await call(`/admin/booking-requests/${booking.id}/status-history?cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, adminCookie), 400);
  await pool.query("DELETE FROM booking_request_status_history WHERE id=$1", [first.history.at(-1).id]);
  const afterDelete = await read(await call(`${path}?limit=50&cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, customerCookie), 200);
  assert.deepEqual(afterDelete.history.map((item: {id:string}) => item.id), second.history.map((item: {id:string}) => item.id));
  await pool.query("DELETE FROM booking_requests WHERE id = ANY($1::uuid[])", [[booking.id, other.id]]);
});

const timesPath = (id: string, date: string) => `/booking-requests/${id}/requested-days/${date}/times`;
const sampleTimes = {startsAt:"2099-12-05T23:00:00+08:00",endsAt:"2099-12-06T02:00:00+08:00"};

test("nonconsecutive dates create atomically in order, appear on every calendar day and preserve conversation policy", async () => {
  const booking = await createDatesBooking(["2099-12-08","2099-12-05","2099-12-07"]);
  assert.deepEqual(booking.requestedDays.map((day: {date:string})=>day.date),["2099-12-05","2099-12-07","2099-12-08"]);
  assert.equal(booking.preferredDate,"2099-12-05");assert.equal(booking.requestedDayCount,3);assert.equal(booking.durationMode,"multi_day");
  assert.equal((await read(await call(`/booking-requests/${booking.id}/status-history`, "GET", undefined, customerCookie), 200)).history.length, 1);
  const conversation = await pool.query("SELECT id FROM conversations WHERE booking_request_id=$1",[booking.id]);
  assert.equal(conversation.rowCount,1);
  const calendar = await read(await call("/admin/booking-requests/calendar?month=2099-12&status=under_review","GET",undefined,adminCookie),200);
  for(const date of ["2099-12-05","2099-12-07","2099-12-08"]) {
    assert.ok(calendar.dailyCounts.some((day: {preferredDate:string,count:number})=>day.preferredDate===date && day.count>=1));
    const page = await read(await call(`/admin/booking-requests?preferredDate=${date}&status=under_review&limit=1`,"GET",undefined,adminCookie),200);
    assert.equal(page.bookingRequests[0].id,booking.id);
  }
  const absent = await read(await call("/admin/booking-requests?preferredDate=2099-12-06","GET",undefined,adminCookie),200);
  assert.ok(!absent.bookingRequests.some((r:{id:string})=>r.id===booking.id));
  const saved = (await read(await call(timesPath(booking.id,"2099-12-05"),"PATCH",{...sampleTimes,expectedUpdatedAt:booking.updatedAt},customerCookie),200)).bookingRequest;
  assert.equal(saved.startsAt,null);assert.equal(saved.endsAt,null);
  assert.deepEqual((await pool.query("SELECT starts_at,ends_at FROM booking_requests WHERE id=$1",[booking.id])).rows[0],{starts_at:null,ends_at:null});
  await read(await call(`/admin/booking-requests/${booking.id}/status`,"PATCH",{status:"accepted"},adminCookie),200);
  const filtered=await read(await call("/admin/booking-requests/calendar?month=2099-12&status=under_review","GET",undefined,adminCookie),200);
  assert.deepEqual(filtered.dailyCounts,[]);
  const accepted=await read(await call("/admin/booking-requests/calendar?month=2099-12&status=accepted","GET",undefined,adminCookie),200);
  assert.deepEqual(accepted.dailyCounts,[{preferredDate:"2099-12-05",count:1},{preferredDate:"2099-12-07",count:1},{preferredDate:"2099-12-08",count:1}]);
});

test("owner saves independent per-day times with exact revisions; roles, state and invalid ranges reject without writes", async () => {
  const booking = await createDatesBooking();
  const path=timesPath(booking.id,"2099-12-05"),input={...sampleTimes,expectedUpdatedAt:booking.updatedAt};
  await read(await call(path,"PATCH",input),401);
  for(const cookie of [adminCookie,staffCookie]) await read(await call(path,"PATCH",input,cookie),403);
  await read(await call(path,"PATCH",input,otherCustomerCookie),404);
  for(const invalid of [{endsAt:undefined},{endsAt:sampleTimes.startsAt},{startsAt:"2099-12-04T23:00:00+08:00"},{endsAt:"2099-12-07T02:00:00+08:00"},{eventDayId:randomUUID()}])
    await read(await call(path,"PATCH",{...input,...invalid},customerCookie),400);
  await read(await call(timesPath(booking.id,"2099-12-06"),"PATCH",input,customerCookie),404);
  assert.deepEqual((await read(await call(`/booking-requests/${booking.id}`,"GET",undefined,customerCookie),200)).bookingRequest,booking);
  // A real database microsecond revision must survive DTO serialization and stale comparison.
  await pool.query("UPDATE booking_requests SET updated_at='2090-01-01T00:00:00.123456Z' WHERE id=$1",[booking.id]);
  const revision=(await read(await call(`/booking-requests/${booking.id}`,"GET",undefined,customerCookie),200)).bookingRequest.updatedAt;
  assert.equal(revision,"2090-01-01T00:00:00.123456Z");
  await read(await call(path,"PATCH",{...input,expectedUpdatedAt:"2090-01-01T00:00:00.123Z"},customerCookie),409);
  const saved=(await read(await call(path,"PATCH",{...input,expectedUpdatedAt:revision},customerCookie),200)).bookingRequest;
  assert.notEqual(saved.updatedAt,revision);
  assert.deepEqual(saved.requestedDays[0],{date:"2099-12-05",startsAt:"2099-12-05T15:00:00.000Z",endsAt:"2099-12-05T18:00:00.000Z",operationalSchedule:null});
  assert.equal(saved.requestedDays[1].startsAt,null);
  await read(await call(path,"PATCH",{...input,expectedUpdatedAt:revision},customerCookie),409);
  const second=(await read(await call(timesPath(booking.id,"2099-12-07"),"PATCH",{startsAt:"2099-12-07T10:00:00+08:00",endsAt:"2099-12-07T12:00:00+08:00",expectedUpdatedAt:saved.updatedAt},customerCookie),200)).bookingRequest;
  assert.deepEqual(second.requestedDays[0],saved.requestedDays[0]);assert.equal(second.requestedDays[2].startsAt,null);
  const needs=(await read(await call(`/admin/booking-requests/${booking.id}/status`,"PATCH",{status:"needs_details",reason:"Details"},adminCookie),200)).bookingRequest;
  await read(await call(path,"PATCH",{...input,expectedUpdatedAt:second.updatedAt},customerCookie),409);
  const editable=(await read(await call(path,"PATCH",{...input,expectedUpdatedAt:needs.updatedAt},customerCookie),200)).bookingRequest;
  assert.equal(editable.status,"needs_details");
  for(const status of ["declined","cancelled"]) {
    const terminal=await createDatesBooking();
    const result=(await read(await call(`/admin/booking-requests/${terminal.id}/status`,"PATCH",{status,reason:"Terminal"},adminCookie),200)).bookingRequest;
    await read(await call(timesPath(terminal.id,"2099-12-05"),"PATCH",{...input,expectedUpdatedAt:result.updatedAt},customerCookie),409);
  }
});

test("repeated DST local times are rejected while unambiguous offset and overnight times persist",async()=>{
  const booking=await createDatesBooking(["2027-11-07"],"America/New_York");
  const path=timesPath(booking.id,"2027-11-07");
  for(const startsAt of ["2027-11-07T01:30:00-04:00","2027-11-07T01:30:00-05:00"])
    await read(await call(path,"PATCH",{startsAt,endsAt:"2027-11-07T03:00:00-05:00",expectedUpdatedAt:booking.updatedAt},customerCookie),400);
  const saved=(await read(await call(path,"PATCH",{startsAt:"2027-11-07T03:00:00-05:00",endsAt:"2027-11-08T01:00:00-05:00",expectedUpdatedAt:booking.updatedAt},customerCookie),200)).bookingRequest;
  assert.equal(saved.requestedDays[0].startsAt,"2027-11-07T08:00:00.000Z");
});

test("concurrent per-day saves reject one stale writer and retain every other entry",async()=>{
  const booking=await createDatesBooking();
  const results=await Promise.all(["2099-12-05","2099-12-07"].map(date=>call(timesPath(booking.id,date),"PATCH",{startsAt:`${date}T10:00:00+08:00`,endsAt:`${date}T12:00:00+08:00`,expectedUpdatedAt:booking.updatedAt},customerCookie)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const saved=(await read(await call(`/booking-requests/${booking.id}`,"GET",undefined,customerCookie),200)).bookingRequest;
  assert.equal(saved.requestedDays.filter((day:{startsAt:string|null})=>day.startsAt!==null).length,1);
});


test("migration keeps legacy estimates, timestamps and related operational data without inventing requested days",async()=>{
  const booking=(await read(await call(`/admin/booking-requests/${dayMigrationBookingId}`,"GET",undefined,adminCookie),200)).bookingRequest;
  assert.equal(booking.requestedDays,null);assert.equal(booking.durationMode,null);assert.equal(booking.requestedDayCount,null);
  assert.equal(booking.estimatedDuration,"more_than_1_week");assert.equal(booking.estimatedDurationDays,9);
  assert.equal(booking.startsAt,"2099-01-01T10:00:00.000Z");assert.equal(booking.endsAt,"2099-01-01T12:00:00.000Z");
  assert.equal(booking.packageName,"Original snapshot");
  assert.equal((await pool.query("SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.booking_request_id=$1 AND m.body='Preserved transcript'",[dayMigrationBookingId])).rowCount,1);
});


test("directory pages combine staff roles, search globally, and keep population statistics", async () => {
  const marker = `directory-${randomUUID()}`;
  const created = await pool.query(`INSERT INTO users(email,display_name,role,staff_role,password_hash)
    SELECT $1 || n || '@example.test', 'Directory ' || lpad(n::text, 3, '0'),
      CASE WHEN n % 2 = 0 THEN 'admin' ELSE 'staff' END, 'Directory role', 'unused'
    FROM generate_series(1, 18) n RETURNING id`, [marker]);
  const base = `/admin/users?group=staff&search=${marker}&limit=7`;
  const first = await read(await call(base, "GET", undefined, adminCookie), 200);
  const second = await read(await call(`${base}&cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, adminCookie), 200);
  const third = await read(await call(`${base}&cursor=${encodeURIComponent(second.nextCursor)}`, "GET", undefined, adminCookie), 200);
  const rows = [...first.staff, ...second.staff, ...third.staff];
  assert.equal(rows.length, 18);
  assert.equal(new Set(rows.map((row: any) => row.id)).size, 18);
  assert.deepEqual(rows.map((row: any) => row.displayName), [...rows.map((row: any) => row.displayName)].sort());
  assert.ok(rows.some((row: any) => row.role === "admin") && rows.some((row: any) => row.role === "staff"));
  assert.ok(first.stats.staffTotal >= created.rows.length);
  assert.deepEqual(first.stats, second.stats);
  assert.equal(third.nextCursor, null);
  await read(await call(`/admin/users?group=customers&cursor=${encodeURIComponent(first.nextCursor)}`, "GET", undefined, adminCookie), 400);
  await read(await call(base, "GET", undefined, customerCookie), 403);
});
