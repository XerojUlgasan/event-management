import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
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
  if (admin) {
    // pg-pool may resolve end() before every idle socket has disconnected.
    // Wait for disconnects instead of forcibly terminating those sockets.
    for (let attempt = 0; attempt < 100; attempt++) {
      const active = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1", [database]);
      if (active.rows[0].count === 0) break;
      await delay(10);
    }
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`); await admin.end();
  }
});
function call(path: string, method = "GET", body?: unknown, cookie?: string, origin?: string) {
  return app.request(`/v1${path}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return status === 204 ? null : response.headers.get("Content-Type")?.startsWith("image/") ? response.arrayBuffer() : response.json();
}

const content = { name: "  Garden  ", location: "  City  ", description: "  Venue description  ", categories: [" Garden "], capacityMax: 100, imageUrls: [] as string[] };
const photo = (name: string) => `https://images.example.test/${name}.jpg`;

test("venue catalog requires complete content and protects admin operations", async () => {
  const created = await read(await call("/admin/venues", "POST", content, adminCookie), 201);
  const path = `/admin/venues/${created.id}`;
  const routes: [string, string, unknown?][] = [
    ["/admin/venues", "GET"], [path, "GET"], ["/admin/venues", "POST", content],
    [path, "PATCH", { ...content, expectedUpdatedAt: created.updatedAt }],
    [`${path}/archive`, "POST"], [path, "DELETE"],
  ];
  for (const [url, method, body] of routes) {
    await read(await call(url, method, body), 401);
    for (const cookie of [staffCookie, customerCookie, undesignatedAdminCookie]) await read(await call(url, method, body, cookie), 403);
  }
  for (const invalid of [
    { ...content, name: "" }, { ...content, location: "" }, { ...content, description: "" },
    { ...content, capacityMax: null }, { ...content, capacityMax: 0 }, { ...content, capacityMax: 1.5 },
    { ...content, categories: ["garden", " Garden "] }, { ...content, imageUrls: ["http://example.test/image.png"] },
    { ...content, imageUrls: Array(11).fill(photo("excess")) }, { ...content, imageUrls: [`/v1/venue-images/${randomUUID()}`] },
  ]) await read(await call("/admin/venues", "POST", invalid, adminCookie), 400);
  await read(await call("/venues/not-a-uuid"), 400);
  await read(await call("/venues?limit=16"), 400);
  await read(await call("/venues?offset=-1"), 400);
  await read(await call("/admin/venues", "POST", content, adminCookie, "https://untrusted.example"), 403);
});

test("venues save directly, publish edits immediately and reject stale or archived writes", async () => {
  const created = await read(await call("/admin/venues", "POST", content, adminCookie), 201);
  const path = `/admin/venues/${created.id}`;
  assert.equal(created.name, "Garden"); assert.equal(created.location, "City");
  assert.deepEqual(created.categories, ["Garden"]); assert.deepEqual(created.imageUrls, []);
  assert.equal(created.capacityMax, 100); assert.ok(created.publishedAt);
  for (const key of ["draft", "published", "versions", "version", "state", "capacityMin"]) assert.equal(key in created, false);
  assert.equal((await read(await call(`/venues/${created.id}`), 200)).name, "Garden");
  const images = [photo("first"), photo("second")];
  const edited = await read(await call(path, "PATCH", { ...content, name: "Changed", imageUrls: images, expectedUpdatedAt: created.updatedAt }, adminCookie), 200);
  const visible = await read(await call(`/venues/${created.id}`), 200);
  assert.equal(visible.name, "Changed"); assert.deepEqual(visible.imageUrls, images);
  await read(await call(path, "PATCH", { ...content, expectedUpdatedAt: created.updatedAt }, adminCookie), 409);
  await read(await call(`${path}/archive`, "POST", undefined, adminCookie), 200);
  await read(await call(`/venues/${created.id}`), 404);
  assert.ok((await read(await call(path, "GET", undefined, adminCookie), 200)).archivedAt);
  await read(await call(path, "PATCH", { ...content, expectedUpdatedAt: edited.updatedAt }, adminCookie), 409);
  await read(await call(path, "DELETE", undefined, adminCookie), 204);
  await read(await call(path, "GET", undefined, adminCookie), 404);
  const live = await read(await call("/admin/venues", "POST", content, adminCookie), 201);
  await read(await call(`/admin/venues/${live.id}`, "DELETE", undefined, adminCookie), 204);
  await read(await call(`/venues/${live.id}`), 404);
});

test("venue photos keep order, reject duplicates, and pagination is stable", async () => {
  const first = photo("cover"), second = photo("detail");
  await read(await call("/admin/venues", "POST", { ...content, imageUrls: [first, first] }, adminCookie), 400);
  const created = await read(await call("/admin/venues", "POST", { ...content, imageUrls: [first, second] }, adminCookie), 201);
  assert.deepEqual((await read(await call(`/venues/${created.id}`), 200)).imageUrls, [first, second]);
  for (let i = 0; i < 17; i++) await read(await call("/admin/venues", "POST", { ...content, name: `Pagination ${String(i).padStart(2, "0")}` }, adminCookie), 201);
  const all = (await read(await call("/venues"), 200)).venues;
  const page1 = await read(await call("/venues?limit=15&offset=0"), 200);
  const page2 = await read(await call(`/venues?limit=15&offset=${page1.nextOffset}`), 200);
  assert.equal(page1.venues.length, 15); assert.equal(page1.nextOffset, 15); assert.equal(page2.nextOffset, null);
  assert.deepEqual([...page1.venues, ...page2.venues].map((v: any) => v.id), all.map((v: any) => v.id));
});

test("concurrent venue edits have one winner and obsolete routes are absent", async () => {
  const created = await read(await call("/admin/venues", "POST", content, adminCookie), 201);
  const path = `/admin/venues/${created.id}`;
  const responses = await Promise.all(["First", "Second"].map(name => call(path, "PATCH", { ...content, name, expectedUpdatedAt: created.updatedAt }, adminCookie)));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  for (const response of responses) await response.text();
  const saved = await read(await call(path, "GET", undefined, adminCookie), 200);
  assert.ok(["First", "Second"].includes(saved.name));
  for (const suffix of ["draft", "publish"]) assert.equal((await call(`${path}/${suffix}`, suffix === "draft" ? "PATCH" : "POST", {}, adminCookie)).status, 404);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/venues/{id}"].patch); assert.ok(spec.paths["/v1/admin/venues/{id}"].delete);
  assert.ok(spec.paths["/v1/admin/venues/{id}/archive"]);
  assert.equal(spec.paths["/v1/admin/venues/{id}/draft"], undefined); assert.equal(spec.paths["/v1/admin/venues/{id}/publish"], undefined);
});
