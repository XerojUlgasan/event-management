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
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
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
  const input = {packageId:pkg.id,packageVersionId:version.id,eventType:"Wedding",startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+90000000).toISOString(),timeZone:"Asia/Manila",guestCount:120,contactName:"Customer",phoneNumber:"123",preferredVenueLocation:"Manila",specialRequests:"Music"};
  await read(await call("/booking-requests","POST",input),401);
  await read(await call("/booking-requests","POST",input,adminCookie),403);
  await read(await call("/admin/booking-requests","GET",undefined,customerCookie),403);
  await read(await call("/booking-requests","POST",{...input,startsAt:new Date(Date.now()-86400000).toISOString()},customerCookie),400);
  await read(await call("/booking-requests","POST",{...input,endsAt:input.startsAt},customerCookie),400);
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
  assert.equal(created.customerId,customerId); assert.equal(created.outOfRange,true); assert.equal(created.status,"under_review"); assert.equal(created.statusHistory.length,1);
  assert.deepEqual((await read(await call("/booking-requests/mine","GET",undefined,otherCustomerCookie),200)).bookingRequests,[]);
  assert.equal((await read(await call("/booking-requests/mine","GET",undefined,customerCookie),200)).bookingRequests[0].id,created.id);
  assert.equal((await read(await call("/admin/booking-requests", "GET", undefined, staffCookie), 200)).bookingRequests[0].id, created.id);
  await read(await call(`/admin/booking-requests/${created.id}/status`, "PATCH", {status:"accepted"}, staffCookie), 403);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"confirmed"},adminCookie),400);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"accepted"},customerCookie),403);
  const updated = (await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"needs_details",reason:"Please clarify"},adminCookie),200)).bookingRequest;
  assert.equal(updated.status,"needs_details"); assert.equal(updated.statusHistory[1].reason,"Please clarify");
  for (const status of ["needs_details", "declined", "cancelled"]) await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status, reason:"  "},adminCookie),400);
  await read(await call(`/admin/booking-requests/${created.id}/status`,"PATCH",{status:"declined", reason:"Unavailable"},adminCookie),200);
  await read(await call(`/booking-requests/${created.id}/cancel`,"PATCH",{reason:"Change of plans"},customerCookie),409);
  const another = (await read(await call("/booking-requests","POST",input,customerCookie),201)).bookingRequest;
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
  await db.updateTable("package_versions").set({state:"superseded"}).where("id","=",version.id).execute();
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  await db.updateTable("packages").set({archived_at:new Date()}).where("id","=",pkg.id).execute();
  await read(await call("/booking-requests","POST",input,customerCookie),409);
  const list = (await read(await call("/admin/booking-requests","GET",undefined,adminCookie),200)).bookingRequests;
  const original = list.find((item: any) => item.id === created.id);
  assert.equal(original.packageName,"Garden"); assert.equal(original.packageVersionId,version.id); assert.equal(original.statusHistory.length,3);
  const spec:any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/booking-requests"].post); assert.ok(spec.paths["/v1/booking-requests/{id}/cancel"].patch); assert.ok(spec.paths["/v1/admin/booking-requests/{id}/status"].patch);
});
