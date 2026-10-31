import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_packages_test_${randomUUID().replaceAll("-", "")}`;
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
const data = { name: "Celebration", eventTypes: ["Birthday"], description: "A celebration", guestMin: 30, guestMax: 100, inclusions: ["Decorations"], exclusions: ["Extra hours"], terms: "Terms apply", imageUrl: null, price: null };
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
  assert.equal("venueDetails" in created.draft, false);
  assert.equal((await pool.query("SELECT venue_details FROM package_versions WHERE id = $1", [created.draft.id])).rows[0].venue_details, "");
  await pool.query("UPDATE package_versions SET venue_details = $1 WHERE id = $2", ["Historical venue details", created.draft.id]);
  assert.deepEqual((await read(await call("/packages"), 200)).packages, []);
  await read(await call(`/packages/${created.id}`), 404);
  await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 400);
  const price = { kind: "fixed", currency: "PHP", amountMinor: 12500000 };
  const missingInclusions = await read(await call("/admin/packages", "POST", { ...data, inclusions: [], exclusions: [], price }, adminCookie), 201);
  await read(await call(`/admin/packages/${missingInclusions.id}/publish`, "POST", { expectedUpdatedAt: missingInclusions.draft.updatedAt }, adminCookie), 400);
  const edited = await read(await call(`${path}/draft`, "PATCH", { ...data, exclusions: [], price, expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
  assert.equal((await pool.query("SELECT venue_details FROM package_versions WHERE id = $1", [created.draft.id])).rows[0].venue_details, "Historical venue details");
  await read(await call(`${path}/draft`, "PATCH", { ...data, price, expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 409);
  await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 409);
  const first = await read(await call(`${path}/publish`, "POST", { expectedUpdatedAt: edited.draft.updatedAt }, adminCookie), 200);
  assert.equal("venueDetails" in await read(await call(`/packages/${created.id}`), 200), false);
  assert.deepEqual((await read(await call(`/packages/${created.id}`), 200)).price, price);
  assert.deepEqual((await read(await call(`/packages/${created.id}`), 200)).inclusions, ["Decorations"]);
  assert.deepEqual((await read(await call(`/packages/${created.id}`), 200)).exclusions, []);
  const replacement = await read(await call(`${path}/draft`, "PATCH", { ...data, name: "New name", price, expectedUpdatedAt: first.published.updatedAt }, adminCookie), 200);
  assert.equal(replacement.draft.version, 2);
  assert.equal((await pool.query("SELECT venue_details FROM package_versions WHERE id = $1", [first.published.id])).rows[0].venue_details, "Historical venue details");
  assert.equal((await pool.query("SELECT venue_details FROM package_versions WHERE id = $1", [replacement.draft.id])).rows[0].venue_details, "");
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

test("package versions keep external image URLs and reject upload paths", async () => {
  const imageUrl = "https://images.example.test/package.jpg";
  await read(await call("/admin/packages", "POST", { ...data, imageUrl: "/v1/package-images/old" }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, imageUrl: "http://images.example.test/package.jpg" }, adminCookie), 400);
  const created = await read(await call("/admin/packages", "POST", { ...data, imageUrl, price: { kind: "fixed", currency: "PHP", amountMinor: 100 } }, adminCookie), 201);
  const published = await read(await call(`/admin/packages/${created.id}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
  assert.equal((await read(await call(`/packages/${created.id}`), 200)).imageUrl, imageUrl);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.equal(spec.paths["/v1/admin/package-images"], undefined);
  assert.ok(published.published);
});

test("services and package assignments preserve published versions and protect public catalog", async () => {
  const content = { name: "Photography", categories: ["Media"], description: "Event coverage", imageUrl: "https://example.com/image.png" };
  await read(await call("/admin/services"), 401);
  await read(await call("/admin/services", "POST", content, customerCookie), 403);
  const created = await read(await call("/admin/services", "POST", content, adminCookie), 201);
  assert.equal((await read(await call("/services"), 200)).services.some((x: any) => x.id === created.id), false);
  await read(await call(`/admin/services/${created.id}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
  const published = await read(await call(`/services/${created.id}`), 200);
  assert.deepEqual(published.categories, ["Media"]);
  assert.equal(published.imageUrl, content.imageUrl);
  for (const key of ["category", "coverage", "durationMinutes", "setupMinutes", "setupNeeds"]) assert.equal(key in published, false);
  const include = { serviceVersionId: published.versionId, role: "included", includedQuantity: 1, addOnPrice: null, addOnMaxQuantity: null };
  const extra = await read(await call("/admin/services", "POST", { ...content, name: "Extra coverage" }, adminCookie), 201);
  const extraPublished = await read(await call(`/admin/services/${extra.id}/publish`, "POST", { expectedUpdatedAt: extra.draft.updatedAt }, adminCookie), 200);
  const addon = { serviceVersionId: extraPublished.published.id, role: "add_on", includedQuantity: null, addOnPrice: { kind: "fixed", currency: "PHP", amountMinor: 250000 }, addOnMaxQuantity: 2 };
  const price = { kind: "fixed", currency: "PHP", amountMinor: 1000000 };
  await read(await call("/admin/packages", "POST", { ...data, price, services: [{...include, addOnPrice: addon.addOnPrice}] }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, price, services: [{...addon, addOnPrice: {...addon.addOnPrice, currency: "USD"}}] }, adminCookie), 400);
  await read(await call("/admin/packages", "POST", { ...data, price, services: [include, { ...addon, serviceVersionId: include.serviceVersionId }] }, adminCookie), 400);
  const pkg = await read(await call("/admin/packages", "POST", { ...data, inclusions: [], price, services: [include, addon] }, adminCookie), 201);
  assert.match(pkg.draft.services[0].id, /^[0-9a-f-]{36}$/);
  const first = await read(await call(`/admin/packages/${pkg.id}/publish`, "POST", { expectedUpdatedAt: pkg.draft.updatedAt }, adminCookie), 200);
  const publicPackage = await read(await call(`/packages/${pkg.id}`), 200);
  assert.equal(publicPackage.services.length, 2);
  const nested = publicPackage.services.find((x: any) => x.role === "included").service;
  assert.deepEqual(nested.categories, ["Media"]);
  assert.equal(nested.imageUrl, content.imageUrl);
  for (const key of ["category", "coverage", "durationMinutes", "setupMinutes", "setupNeeds"]) assert.equal(key in nested, false);
  assert.deepEqual(publicPackage.services.find((x: any) => x.role === "add_on").addOnPrice, addon.addOnPrice);
  const serviceDraft = await read(await call(`/admin/services/${created.id}/draft`, "PATCH", { ...content, name: "Updated photography", expectedUpdatedAt: published.publishedAt }, adminCookie), 200);
  await read(await call(`/admin/services/${created.id}/publish`, "POST", { expectedUpdatedAt: serviceDraft.draft.updatedAt }, adminCookie), 200);
  assert.equal((await read(await call(`/packages/${pkg.id}`), 200)).services.find((x: any) => x.role === "included").service.name, "Photography");
  await read(await call(`/admin/services/${created.id}/archive`, "POST", undefined, adminCookie), 409);
  await read(await call(`/admin/services/${created.id}`, "DELETE", undefined, adminCookie), 409);
  const currentService = await read(await call(`/services/${created.id}`), 200);
  const next = await read(await call(`/admin/packages/${pkg.id}/draft`, "PATCH", { ...data, price, services: [{ ...include, serviceVersionId: currentService.versionId }], expectedUpdatedAt: first.published.updatedAt }, adminCookie), 200);
  assert.equal(next.published.services.length, 2);
  assert.equal(next.draft.services.length, 1);
  assert.equal((await read(await call(`/packages/${pkg.id}`), 200)).services.length, 2);
  await read(await call(`/admin/packages/${pkg.id}/archive`, "POST", undefined, adminCookie), 200);
  await read(await call(`/admin/services/${created.id}/archive`, "POST", undefined, adminCookie), 200);
  await read(await call(`/services/${created.id}`), 404);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/services/{id}/publish"].post);
});


test("service versions retain external image URLs across package snapshots", async () => {
  const imageUrl = "https://images.example.test/service.jpg";
  const content = { name: "Photo", categories: [" Media "], description: "Coverage", imageUrl };
  await read(await call("/admin/services", "POST", { ...content, imageUrl: "/v1/service-images/old" }, adminCookie), 400);
  await read(await call("/admin/services", "POST", { ...content, imageUrl: "http://images.example.test/service.jpg" }, adminCookie), 400);
  const created = await read(await call("/admin/services", "POST", content, adminCookie), 201);
  assert.deepEqual(created.draft.categories, ["Media"]);
  const first = await read(await call(`/admin/services/${created.id}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
  const assignment = { serviceVersionId: first.published.id, role: "included", includedQuantity: 1, addOnPrice: null, addOnMaxQuantity: null };
  const pkg = await read(await call("/admin/packages", "POST", { ...data, price: { kind: "fixed", currency: "PHP", amountMinor: 100 }, services: [assignment] }, adminCookie), 201);
  await read(await call(`/admin/packages/${pkg.id}/publish`, "POST", { expectedUpdatedAt: pkg.draft.updatedAt }, adminCookie), 200);
  const draft = await read(await call(`/admin/services/${created.id}/draft`, "PATCH", { ...content, imageUrl: null, expectedUpdatedAt: first.published.updatedAt }, adminCookie), 200);
  await read(await call(`/admin/services/${created.id}/publish`, "POST", { expectedUpdatedAt: draft.draft.updatedAt }, adminCookie), 200);
  assert.equal((await read(await call(`/packages/${pkg.id}`), 200)).services[0].service.imageUrl, imageUrl);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.equal(spec.paths["/v1/admin/service-images"], undefined);
});

test("public catalog pages load 15 at a time and service previews list included packages", async () => {
  const serviceContent = { name: "Catalog service", categories: ["Experience"], description: "For page testing", imageUrl: null };
  const serviceIds: string[] = [];
  for (let index = 0; index < 16; index++) {
    const created = await read(await call("/admin/services", "POST", { ...serviceContent, name: `Catalog service ${index}` }, adminCookie), 201);
    await read(await call(`/admin/services/${created.id}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
    serviceIds.push(created.id);
  }
  await read(await call("/services?limit=0"), 400);
  await read(await call("/services?limit=16"), 400);
  await read(await call("/services?limit=15&offset=-1"), 400);
  const firstServices = await read(await call("/services?limit=15"), 200);
  const secondServices = await read(await call("/services?limit=15&offset=15"), 200);
  assert.equal(firstServices.services.length, 15);
  assert.equal(firstServices.nextOffset, 15);
  assert.ok(secondServices.services.length >= 1);
  assert.equal(new Set([...firstServices.services, ...secondServices.services].map((row: any) => row.id)).size, firstServices.services.length + secondServices.services.length);
  assert.equal((await read(await call("/services?limit=3"), 200)).services.length, 3);

  const target = await read(await call(`/services/${serviceIds[0]}`), 200);
  const included = { serviceVersionId: target.versionId, role: "included", includedQuantity: 1, addOnPrice: null, addOnMaxQuantity: null };
  const addOn = { serviceVersionId: target.versionId, role: "add_on", includedQuantity: null, addOnPrice: { kind: "fixed", currency: "PHP", amountMinor: 100 }, addOnMaxQuantity: 1 };
  const price = { kind: "fixed", currency: "PHP", amountMinor: 100000 };
  let includedPackageId = "";
  let addOnPackageId = "";
  for (let index = 0; index < 16; index++) {
    const assignment = index === 0 ? [included] : index === 1 ? [addOn] : [];
    const created = await read(await call("/admin/packages", "POST", { ...data, name: `Catalog package ${index}`, price, services: assignment }, adminCookie), 201);
    await read(await call(`/admin/packages/${created.id}/publish`, "POST", { expectedUpdatedAt: created.draft.updatedAt }, adminCookie), 200);
    if (index === 0) includedPackageId = created.id;
    if (index === 1) addOnPackageId = created.id;
  }
  await read(await call("/packages?limit=16"), 400);
  const firstPackages = await read(await call("/packages?limit=15"), 200);
  const secondPackages = await read(await call("/packages?limit=15&offset=15"), 200);
  assert.equal(firstPackages.packages.length, 15);
  assert.equal(firstPackages.nextOffset, 15);
  assert.ok(secondPackages.packages.length >= 1);
  assert.equal(new Set([...firstPackages.packages, ...secondPackages.packages].map((row: any) => row.id)).size, firstPackages.packages.length + secondPackages.packages.length);
  assert.equal((await read(await call("/packages?limit=3"), 200)).packages.length, 3);
  const related = await read(await call(`/services/${target.id}/packages`), 200);
  assert.ok(related.packages.some((row: any) => row.id === includedPackageId));
  assert.ok(!related.packages.some((row: any) => row.id === addOnPackageId));
  const serviceAdmin = await read(await call(`/admin/services/${target.id}`, "GET", undefined, adminCookie), 200);
  const revised = await read(await call(`/admin/services/${target.id}/draft`, "PATCH", { ...serviceContent, name: "Revised catalog service", expectedUpdatedAt: serviceAdmin.published.updatedAt }, adminCookie), 200);
  await read(await call(`/admin/services/${target.id}/publish`, "POST", { expectedUpdatedAt: revised.draft.updatedAt }, adminCookie), 200);
  assert.ok((await read(await call(`/services/${target.id}/packages`), 200)).packages.some((row: any) => row.id === includedPackageId));
  await read(await call(`/admin/packages/${includedPackageId}/archive`, "POST", undefined, adminCookie), 200);
  assert.ok(!(await read(await call(`/services/${target.id}/packages`), 200)).packages.some((row: any) => row.id === includedPackageId));
  await read(await call(`/services/${randomUUID()}/packages`), 404);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/services/{id}/packages"].get);
});
