import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_venues_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let staffCookie: string;
let undesignatedAdminCookie: string;
let customerCookie: string;

before(async () => {
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST ?? "localhost"), "Tests require local PostgreSQL");
  const connection = { host: process.env.DB_HOST ?? "localhost", port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
  }
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: string, staffRole: string | null = null) {
    const token = randomUUID();
    const user = await db.insertInto("users").values({ email: `${role}-${randomUUID()}@example.test`, password_hash: "unused", role, staff_role: staffRole }).returning("id").executeTakeFirstOrThrow();
    await db.insertInto("sessions").values({ user_id: user.id, token_hash: hashSessionToken(token), expires_at: new Date(Date.now() + 3600000) }).execute();
    return `em_session=${token}`;
  }
  adminCookie = await session("admin", "System Administrator");
  undesignatedAdminCookie = await session("admin");
  staffCookie = await session("staff", "Waiter");
  customerCookie = await session("customer");
});
after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`); await admin.end(); }
});
function call(path: string, method = "GET", body?: unknown, cookie?: string, origin?: string) {
  return app.request(`/v1${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.json();
}

test("venue routes validate, normalize, and archive catalog records", async () => {
  const { venueSchema } = await import("../src/controllers/venues/schemas.js");
  const legacyId = "b1000000-0000-0000-0000-000000000001";
  await pool.query("INSERT INTO venues (id, name, location, description) VALUES ($1, $2, $3, $4)", [legacyId, "Sample", "Demo", "Demo only"]);
  const legacy = await read(await call(`/venues/${legacyId}`), 200);
  assert.ok(venueSchema.safeParse(legacy).success);
  assert.ok(venueSchema.safeParse((await read(await call("/venues"), 200)).venues[0]).success);
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const path = method === "GET" ? "/venues/not-a-uuid" : "/admin/venues/not-a-uuid";
    await read(await call(path, method, method === "PATCH" ? { name: "A", location: "B", description: "C" } : undefined, adminCookie), 400);
  }
  const input = { name: "  Sample hall  ", location: "  Demo city  ", description: "  Demo description  " };
  await read(await call("/admin/venues", "POST", input), 401);
  await read(await call("/admin/venues", "POST", input, customerCookie), 403);
  await read(await call("/admin/venues", "POST", input, staffCookie), 403);
  await read(await call("/admin/venues", "POST", input, undesignatedAdminCookie), 403);
  for (const field of ["name", "location", "description"]) {
    await read(await call("/admin/venues", "POST", { ...input, [field]: "  " }, adminCookie), 400);
    await read(await call(`/admin/venues/${legacyId}`, "PATCH", { ...input, [field]: "  " }, adminCookie), 400);
  }
  const created = await read(await call("/admin/venues", "POST", input, adminCookie), 201);
  assert.deepEqual([created.name, created.location, created.description], ["Sample hall", "Demo city", "Demo description"]);
  assert.ok(venueSchema.safeParse(created).success);
  for (const cookie of [staffCookie, undesignatedAdminCookie, customerCookie]) {
    await read(await call(`/admin/venues/${created.id}`, "PATCH", input, cookie), 403);
    await read(await call(`/admin/venues/${created.id}`, "DELETE", undefined, cookie), 403);
  }
  await read(await call(`/admin/venues/${created.id}`, "PATCH", { ...input, name: " Revised " }, adminCookie), 200);
  await read(await call(`/admin/venues/${created.id}`, "DELETE", undefined, adminCookie), 200);
  await read(await call(`/venues/${created.id}`), 404);
  await read(await call(`/admin/venues/${created.id}`, "PATCH", input, adminCookie), 409);
  assert.ok(!(await read(await call("/venues"), 200)).venues.some((v: any) => v.id === created.id));
});

test("seed reruns preserve edited and archived sample venues", async () => {
  const id = "b1000000-0000-0000-0000-000000000002";
  await pool.query("INSERT INTO venues (id, name, location, description, archived_at) VALUES ($1, $2, $3, $4, now())", [id, "Edited venue", "Edited location", "Approved copy"]);
  const runSeed = () => promisify(execFile)(process.execPath, ["--import", "tsx", "src/db/seed.ts"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, FIREBASE_PROJECT_ID: "", FIREBASE_CLIENT_EMAIL: "", FIREBASE_PRIVATE_KEY: "", GOOGLE_APPLICATION_CREDENTIALS: "" },
  });
  await runSeed();
  await runSeed();
  const row = await pool.query("SELECT name, location, description, archived_at FROM venues WHERE id = $1", [id]);
  assert.deepEqual([row.rows[0].name, row.rows[0].location, row.rows[0].description], ["Edited venue", "Edited location", "Approved copy"]);
  assert.ok(row.rows[0].archived_at);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM venues WHERE id::text LIKE 'b1000000-0000-0000-0000-0000000000%'")).rows[0].count, 15);
});

test("venue picker details fit the package API limit", async () => {
  const { venueDetailsFromSelection } = await import("../../web/src/lib/venue-details.js");
  const venue = { name: "N".repeat(200), location: "L".repeat(200), description: "D".repeat(4000) };
  const details = venueDetailsFromSelection(venue);
  assert.equal(details.length, 4000);
  assert.ok(details.startsWith(`${venue.name} — ${venue.location}. `));
  assert.ok(details.endsWith("…"));
  const packageContent = { name: "Sample", eventTypes: [], description: "Demo", guestMin: 30, guestMax: 100, venueDetails: details, inclusions: [], exclusions: [], terms: "Demo", imageUrl: null, price: null };
  const result = await read(await call("/admin/packages", "POST", packageContent, adminCookie), 201);
  assert.equal(result.draft.venueDetails, details);
});
