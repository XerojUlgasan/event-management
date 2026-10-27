import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSessionToken } from "../src/lib/session.js";

const database = `em_packages_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
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
  async function session(role: string) {
    const token = randomUUID();
    const user = await db.insertInto("users").values({ id: randomUUID(), email: `${role}@example.test`, password_hash: "unused", role }).returning("id").executeTakeFirstOrThrow();
    await db.insertInto("sessions").values({ id: randomUUID(), user_id: user.id, token_hash: hashSessionToken(token), expires_at: new Date(Date.now() + 3600000) }).execute();
    return `em_session=${token}`;
  }
  adminCookie = await session("admin");
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
const data = { name: "Celebration", eventTypes: ["Birthday"], description: "A celebration", guestMin: 30, guestMax: 100, venueDetails: "Main hall", inclusions: ["Decorations"], exclusions: ["Extra hours"], terms: "Terms apply", imageUrl: null, price: null };
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}

test("catalog protects drafts, validates price, preserves versions and archives published offers", async () => {
  await read(await call("/admin/packages"), 401);
  await read(await call("/admin/packages", "GET", undefined, customerCookie), 403);
  await read(await call("/admin/packages", "POST", data, customerCookie), 403);
  await read(await call("/admin/packages", "POST", { ...data, guestMin: 101 }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, guestMin: 80, guestMax: 30 }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, price: { kind: "per_guest", currency: "PHP", amountMinor: 1 } }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, price: { kind: "fixed", currency: "USD", amountMinor: 1 } }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, price: { kind: "fixed", currency: "PHP", amountMinor: 0 } }, adminCookie), 400);
  const created = await read(await call("/admin/packages", "POST", data, adminCookie), 201);
  const path = `/admin/packages/${created.id}`;
  assert.deepEqual(created.draft.inclusions, ["Decorations"]);
  assert.deepEqual((await read(await call("/packages"), 200)).packages, []);
  await read(await call(`/packages/${created.id}`), 404);
  await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 400);
  const price = { kind: "fixed", currency: "PHP", amountMinor: 12500000 };
  const missingInclusions = await read(await call("/admin/packages", "POST", { ...data, inclusions: [], exclusions: [], price }, adminCookie), 201);
  await read(await call(`/admin/packages/${missingInclusions.id}/publish`, "POST", { expectedUpdatedAt: missingInclusions.draft.updatedAt }, adminCookie), 400);
  const edited = await read(await call(`${path}/draft`, "PATCH", { ...data, exclusions: [], price, expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
  await read(await call(`${path}/draft`, "PATCH", { ...data, price, expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 409);
  await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 409);
  const first = await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: edited.draft.updatedAt }, adminCookie), 200);
  assert.deepEqual((await read(await call(`/packages/${created.id}`), 200)).price, price);
  assert.deepEqual((await read(await call(`/packages/${created.id}`), 200)).inclusions, ["Decorations"]);
  assert.deepEqual((await read(await call(`/packages/${created.id}`), 200)).exclusions, []);
  const replacement = await read(await call(`${path}/draft`, "PATCH", { ...data, name: "New name", price, expectedUpdatedAt: first.published.updatedAt }, adminCookie), 200);
  assert.equal(replacement.draft.version, 2);
  assert.equal((await read(await call(`/packages/${created.id}`), 200)).name, "Celebration");
  const second = await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: replacement.draft.updatedAt }, adminCookie), 200);
  assert.equal(second.versions.find((v: any) => v.version === 1).state, "superseded");
  assert.equal((await read(await call(`/packages/${created.id}`), 200)).name, "New name");
  await read(await call(path, "DELETE", undefined, adminCookie), 409);
  const pending = await read(await call(`${path}/draft`, "PATCH", { ...data, price, expectedUpdatedAt: second.published.updatedAt }, adminCookie), 200);
  await read(await call(`${path}/archive`, "POST", undefined, adminCookie), 200);
  await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: pending.draft.updatedAt }, adminCookie), 409);
  await read(await call(`${path}/draft`, "PATCH", { ...data, price, expectedUpdatedAt: pending.draft.updatedAt }, adminCookie), 409);
  await read(await call(`/packages/${created.id}`), 404);
  assert.equal((await read(await call(path, "GET", undefined, adminCookie), 200)).versions.length, 3);
  const draft = await read(await call("/admin/packages", "POST", data, adminCookie), 201);
  await pool.query("CREATE TABLE test_references (package_id UUID REFERENCES packages(id))");
  await pool.query("INSERT INTO test_references (package_id) VALUES ($1)", [draft.id]);
  await read(await call(`/admin/packages/${draft.id}`, "DELETE", undefined, adminCookie), 409);
  await pool.query("DELETE FROM test_references");
  await read(await call(`/admin/packages/${draft.id}`, "DELETE", undefined, adminCookie), 204);
  await read(await call(`/admin/packages/${draft.id}`, "GET", undefined, adminCookie), 404);
  await read(await call(path, "DELETE", undefined, adminCookie, "https://untrusted.example"), 403);
  assert.ok(edited.draft.updatedAt !== created.draft.updatedAt);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/packages/{id}/draft"].patch);
});

test("image uploads require admin access and validate content", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 1]);
  const upload = (bytes: Uint8Array, type: string, cookie?: string) => {
    const form = new FormData();
    form.set("image", new File([Uint8Array.from(bytes)], "upload", { type }));
    return app.request("/v1/admin/package-images", { method: "POST", headers: cookie ? { Cookie: cookie } : {}, body: form });
  };
  await read(await upload(png, "image/png"), 401);
  await read(await upload(png, "image/png", customerCookie), 403);
  await read(await upload(png, "image/gif", adminCookie), 400);
  await read(await upload(jpeg, "image/png", adminCookie), 400);
  await read(await upload(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png", adminCookie), 400);
  for (const [bytes, type] of [[png, "image/png"], [jpeg, "image/jpeg"]] as const) {
    const { imageUrl } = await read(await upload(bytes, type, adminCookie), 201);
    assert.equal((await app.request(imageUrl)).status, 404);
    assert.equal((await app.request(imageUrl, { headers: { Cookie: customerCookie } })).status, 404);
    const response = await app.request(imageUrl, { headers: { Cookie: adminCookie } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), type);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    await read(await call("/admin/packages", "POST", { ...data, imageUrl }, adminCookie), 201);
  }
  const max = Buffer.alloc(5 * 1024 * 1024);
  png.copy(max);
  await read(await upload(max, "image/png", adminCookie), 201);
  await read(await call(`/package-images/${randomUUID()}`), 404);
  await read(await call("/admin/packages", "POST", { ...data, imageUrl: "data:image/png;base64,AA==" }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, imageUrl: "https://example.com/photo.png" }, adminCookie), 201);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/package-images"].post);
  assert.ok(spec.paths["/v1/package-images/{id}"].get);
  assert.ok(spec.paths["/v1/admin/package-images/{id}"].delete);
});

test("image visibility and cleanup follow package versions", async () => {
  const upload = async () => {
    const form = new FormData();
    form.set("image", new File([Uint8Array.from([0xff, 0xd8, 0xff, 1])], "image.jpg", { type: "image/jpeg" }));
    return (await read(await app.request("/v1/admin/package-images", { method: "POST", headers: { Cookie: adminCookie }, body: form }), 201)).imageUrl as string;
  };
  const del = (url: string, cookie?: string, origin?: string) => call(`/admin/package-images/${url.split("/").pop()}`, "DELETE", undefined, cookie, origin);
  const unreferenced = await upload();
  await read(await del(unreferenced), 401);
  await read(await del(unreferenced, customerCookie), 403);
  await read(await del(unreferenced, adminCookie, "https://untrusted.example"), 403);
  await read(await del(unreferenced, adminCookie), 204);
  await read(await del(unreferenced, adminCookie), 404);
  await read(await call("/admin/packages", "POST", { ...data, imageUrl: unreferenced }, adminCookie), 400);

  const draftImage = await upload();
  const publishedImage = await upload();
  const finalImage = await upload();
  const price = { kind: "fixed", currency: "PHP", amountMinor: 100 };
  const created = await read(await call("/admin/packages", "POST", { ...data, imageUrl: draftImage, price }, adminCookie), 201);
  const path = `/admin/packages/${created.id}`;
  await read(await call(`${path}/draft`, "PATCH", { ...data, imageUrl: `http://localhost:3000${draftImage}`, price, expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 400);
  assert.equal((await app.request(draftImage, { headers: { Cookie: adminCookie } })).status, 200);
  await read(await del(draftImage, adminCookie), 409);
  const updated = await read(await call(`${path}/draft`, "PATCH", { ...data, imageUrl: publishedImage, price, expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
  assert.equal((await app.request(draftImage, { headers: { Cookie: adminCookie } })).status, 404);
  assert.equal((await app.request(publishedImage)).status, 404);
  const first = await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: updated.draft.updatedAt }, adminCookie), 200);
  assert.equal((await app.request(publishedImage)).status, 200);
  await read(await call(`${path}/draft`, "PATCH", { ...data, imageUrl: `http://localhost:3000${publishedImage}`, price, expectedUpdatedAt: first.published.updatedAt }, adminCookie), 400);
  assert.equal((await app.request(publishedImage)).status, 200);
  const next = await read(await call(`${path}/draft`, "PATCH", { ...data, imageUrl: finalImage, price, expectedUpdatedAt: first.published.updatedAt }, adminCookie), 200);
  assert.equal((await app.request(finalImage)).status, 404);
  const second = await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: next.draft.updatedAt }, adminCookie), 200);
  assert.equal((await app.request(publishedImage)).status, 404);
  assert.equal((await app.request(publishedImage, { headers: { Cookie: adminCookie } })).status, 200);
  await read(await del(publishedImage, adminCookie), 409);
  assert.equal((await app.request(finalImage)).status, 200);
  await read(await call(`${path}/archive`, "POST", undefined, adminCookie), 200);
  assert.equal((await app.request(finalImage)).status, 404);
  assert.equal((await app.request(finalImage, { headers: { Cookie: adminCookie } })).status, 200);
  await read(await del(finalImage, adminCookie), 409);

  const deleteImage = await upload();
  const deletable = await read(await call("/admin/packages", "POST", { ...data, imageUrl: deleteImage }, adminCookie), 201);
  await read(await call(`/admin/packages/${deletable.id}`, "DELETE", undefined, adminCookie), 204);
  assert.equal((await app.request(deleteImage, { headers: { Cookie: adminCookie } })).status, 404);
  assert.ok(second.published);
});
