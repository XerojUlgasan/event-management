import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_quotation_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let customerCookie: string;
let otherCustomerCookie: string;
let packageId: string;

before(async () => {
  const connection = { host: process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true })).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: string, name: string) {
    const token = randomUUID();
    const user = await db.insertInto("users").values({ email: `${role}-${randomUUID()}@example.test`, display_name: name, password_hash: "unused", role, staff_role: role === "admin" ? "System Administrator" : null }).returning("id").executeTakeFirstOrThrow();
    await db.insertInto("sessions").values({ user_id: user.id, token_hash: hashSessionToken(token), expires_at: new Date(Date.now() + 3600000) }).execute();
    return `em_session=${token}`;
  }
  adminCookie = await session("admin", "Admin");
  customerCookie = await session("customer", "Customer");
  otherCustomerCookie = await session("customer", "Other Customer");
  packageId = (await db.insertInto("packages").values({ name: "Garden", max_guests: 100, price: 150_000 }).returning("id").executeTakeFirstOrThrow()).id;
});

after(async () => {
  await db?.destroy();
  await pool?.end();
  await admin?.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin?.end();
});

function call(path: string, method = "GET", body?: unknown, cookie?: string) {
  return app.request(`/v1${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}
async function booking(cookie = customerCookie) {
  return (await read(await call("/booking-requests", "POST", { packageId, eventType: "Wedding", preferredDate: "2099-01-02", estimatedDuration: "8_hours", timeZone: "Asia/Manila", guestCount: 80, contactName: "Customer", phoneNumber: "123" }, cookie), 201)).bookingRequest;
}

test("quotation lifecycle computes totals, retains versions, and separates acceptance from booking status", async () => {
  const bookingRequest = await booking();
  const created = (await read(await call(`/admin/booking-requests/${bookingRequest.id}/quotations`, "POST", undefined, adminCookie), 201)).quotation;
  assert.equal(created.version, 1);
  assert.equal(created.baseAmountMinor, 15_000_000);
  await read(await call(`/admin/quotations/${created.id}`, "PATCH", { items: [{ direction: "add", kind: "addition", description: "Extra hour", amountMinor: 10_000 }] }, adminCookie), 200);
  const sent = (await read(await call(`/admin/quotations/${created.id}/send`, "POST", undefined, adminCookie), 200)).quotation;
  assert.equal(sent.totalAmountMinor, 15_010_000);
  assert.equal(sent.status, "sent");
  const history = (await read(await call(`/admin/booking-requests/${bookingRequest.id}/quotations`, "GET", undefined, adminCookie), 200)).quotations;
  assert.equal(history.length, 1);
  await read(await call(`/booking-requests/${bookingRequest.id}/quotation`, "GET", undefined, otherCustomerCookie), 404);
  const accepted = (await read(await call(`/quotations/${sent.id}/accept`, "POST", undefined, customerCookie), 200)).quotation;
  assert.equal(accepted.status, "accepted");
  const bookingAfterAccept = (await read(await call(`/booking-requests/${bookingRequest.id}`, "GET", undefined, customerCookie), 200)).bookingRequest;
  assert.equal(bookingAfterAccept.status, "under_review");
  const revision = (await read(await call(`/quotations/${sent.id}/revision`, "POST", { reason: "Please adjust the event length" }, customerCookie), 201)).quotation;
  assert.equal(revision.version, 2);
  assert.equal(revision.status, "draft");
  assert.deepEqual(revision.items.map((item: any) => [item.description, item.amountMinor]), [["Extra hour", 10_000]]);
  const second = (await read(await call(`/admin/booking-requests/${bookingRequest.id}/quotations`, "GET", undefined, adminCookie), 200)).quotations;
  assert.deepEqual(second.map((quote: any) => [quote.version, quote.status]), [[2, "draft"], [1, "superseded"]]);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/booking-requests/{id}/quotations"].post);
  assert.ok(spec.paths["/v1/quotations/{id}/accept"].post);
});

test("quotation permissions and state transitions are enforced", async () => {
  const bookingRequest = await booking();
  const created = (await read(await call(`/admin/booking-requests/${bookingRequest.id}/quotations`, "POST", undefined, adminCookie), 201)).quotation;
  await read(await call(`/admin/quotations/${created.id}/send`, "POST", undefined, adminCookie), 400);
  await read(await call(`/admin/quotations/${created.id}`, "PATCH", { items: [{ direction: "deduct", kind: "deduction", description: "Discount", amountMinor: 20_000 }] }, customerCookie), 403);
  await read(await call(`/admin/quotations/${created.id}`, "PATCH", { items: [{ direction: "deduct", kind: "deduction", description: "Discount", amountMinor: 20_000 }] }, adminCookie), 200);
  await read(await call(`/admin/quotations/${created.id}/send`, "POST", undefined, adminCookie), 200);
});

test("concurrent sends keep one active quote and concurrent accepts allow one winner", async () => {
  const bookingRequest = await booking();
  const first = (await read(await call(`/admin/booking-requests/${bookingRequest.id}/quotations`, "POST", undefined, adminCookie), 201)).quotation;
  const second = (await read(await call(`/admin/booking-requests/${bookingRequest.id}/quotations`, "POST", undefined, adminCookie), 201)).quotation;
  const item = { direction: "add", kind: "addition", description: "Staff overtime", amountMinor: 5_000 };
  await read(await call(`/admin/quotations/${first.id}`, "PATCH", { items: [item] }, adminCookie), 200);
  await read(await call(`/admin/quotations/${second.id}`, "PATCH", { items: [item] }, adminCookie), 200);
  const sends = await Promise.all([
    call(`/admin/quotations/${first.id}/send`, "POST", undefined, adminCookie),
    call(`/admin/quotations/${second.id}/send`, "POST", undefined, adminCookie),
  ]);
  assert.deepEqual(sends.map(response => response.status).sort(), [200, 200]);
  const history = (await read(await call(`/admin/booking-requests/${bookingRequest.id}/quotations`, "GET", undefined, adminCookie), 200)).quotations;
  assert.equal(history.filter((quote: any) => quote.status === "sent").length, 1);
  const sent = history.find((quote: any) => quote.status === "sent");
  const accepts = await Promise.all([
    call(`/quotations/${sent.id}/accept`, "POST", undefined, customerCookie),
    call(`/quotations/${sent.id}/accept`, "POST", undefined, customerCookie),
  ]);
  assert.deepEqual(accepts.map(response => response.status).sort(), [200, 409]);
});
