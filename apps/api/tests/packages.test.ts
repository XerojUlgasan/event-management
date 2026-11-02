import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
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
let storageServer: Server;
let failStorageDeletes = false;
const storedImages = new Map<string, { bytes: Buffer; contentType: string }>();

before(async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
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
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }
  storageServer = createServer(async (req, res) => {
    const path = req.url!.split("?")[0]!;
    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      storedImages.set(path, {
        bytes: Buffer.concat(chunks),
        contentType: String(req.headers["content-type"]),
      });
      res.end();
    } else if (req.method === "DELETE") {
      if (failStorageDeletes) {
        res.statusCode = 403;
        res.end();
      } else {
        storedImages.delete(path);
        res.statusCode = 204;
        res.end();
      }
    } else {
      const image = storedImages.get(path);
      if (!image) {
        res.statusCode = 404;
        res.end();
      } else {
        res.setHeader("Content-Type", image.contentType);
        res.end(image.bytes);
      }
    }
  });
  await new Promise<void>((resolve) =>
    storageServer.listen(0, "127.0.0.1", resolve),
  );
  const address = storageServer.address();
  assert.ok(address && typeof address !== "string");
  process.env.R2_ENDPOINT = `http://127.0.0.1:${address.port}`;
  process.env.R2_BUCKET_NAME = "test";
  process.env.R2_ACCESS_KEY_ID = "test";
  process.env.R2_SECRET_ACCESS_KEY = "test";
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: string, staffRole: string | null = null) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${role}-${randomUUID()}@example.test`,
        password_hash: "unused",
        role,
        staff_role: staffRole,
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
    return `em_session=${token}`;
  }
  adminCookie = await session("admin", "System Administrator");
  undesignatedAdminCookie = await session("admin");
  staffCookie = await session("staff", "Waiter");
  customerCookie = await session("customer");
});
after(async () => {
  if (storageServer)
    await new Promise<void>((resolve, reject) =>
      storageServer.close((err) => (err ? reject(err) : resolve())),
    );
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  origin?: string,
) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const data = {
  name: "Celebration",
  eventTypes: ["Birthday"],
  description: "A celebration",
  guestMax: 100,
  inclusions: ["Decorations"],
  exclusions: ["Extra hours"],
  imageUrl: null,
  price: null,
};
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}

test("catalog protects drafts, validates price, preserves versions and archives published offers", async () => {
  await read(await call("/admin/packages"), 401);
  await read(
    await call("/admin/packages", "GET", undefined, customerCookie),
    403,
  );
  await read(await call("/admin/packages", "POST", data, customerCookie), 403);
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, guestMax: 0 },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, guestMax: 1.5 },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, guestMax: 2147483648 },
      adminCookie,
    ),
    400,
  );
  const lowerBound = await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, guestMax: 1 },
      adminCookie,
    ),
    201,
  );
  assert.equal(lowerBound.draft.guestMax, 1);
  assert.equal("guestMin" in lowerBound.draft, false);
  const upperBound = await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, guestMax: 2147483647 },
      adminCookie,
    ),
    201,
  );
  assert.equal(upperBound.draft.guestMax, 2147483647);
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        price: { kind: "per_guest", currency: "PHP", amountMinor: 1 },
      },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, price: { kind: "fixed", currency: "USD", amountMinor: 1 } },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, price: { kind: "fixed", currency: "PHP", amountMinor: 0 } },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        price: { kind: "fixed", currency: "PHP", amountMinor: 12500001 },
      },
      adminCookie,
    ),
    400,
  );
  const created = await read(
    await call("/admin/packages", "POST", data, adminCookie),
    201,
  );
  const path = `/admin/packages/${created.id}`;
  assert.equal(created.draft.guestMax, 100);
  assert.equal("guestMin" in created.draft, false);
  assert.deepEqual(created.draft.inclusions, ["Decorations"]);
  assert.equal("venueDetails" in created.draft, false);
  assert.equal("terms" in created.draft, false);
  const removedColumns = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'package_versions' AND column_name IN ('guest_min', 'venue_details', 'terms', 'price_amount_minor') ORDER BY column_name",
  );
  assert.deepEqual(removedColumns.rows, []);
  assert.deepEqual((await read(await call("/packages"), 200)).packages, []);
  await read(await call(`/packages/${created.id}`), 404);
  await read(
    await call(
      `${path}/publish`,
      "POST",
      { expectedUpdatedAt: created.draft.updatedAt },
      adminCookie,
    ),
    400,
  );
  const price = { kind: "fixed", currency: "PHP", amountMinor: 12500000 };
  const missingInclusions = await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, inclusions: [], exclusions: [], price },
      adminCookie,
    ),
    201,
  );
  await read(
    await call(
      `/admin/packages/${missingInclusions.id}/publish`,
      "POST",
      { expectedUpdatedAt: missingInclusions.draft.updatedAt },
      adminCookie,
    ),
    400,
  );
  const edited = await read(
    await call(
      `${path}/draft`,
      "PATCH",
      {
        ...data,
        exclusions: [],
        price,
        expectedUpdatedAt: created.draft.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    (
      await pool.query("SELECT price FROM package_versions WHERE id = $1", [
        created.draft.id,
      ])
    ).rows[0].price,
    125000,
  );
  await read(
    await call(
      `${path}/draft`,
      "PATCH",
      { ...data, price, expectedUpdatedAt: created.draft.updatedAt },
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `${path}/publish`,
      "POST",
      { expectedUpdatedAt: created.draft.updatedAt },
      adminCookie,
    ),
    409,
  );
  const first = await read(
    await call(
      `${path}/publish`,
      "POST",
      { expectedUpdatedAt: edited.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    "venueDetails" in (await read(await call(`/packages/${created.id}`), 200)),
    false,
  );
  assert.deepEqual(
    (await read(await call(`/packages/${created.id}`), 200)).price,
    price,
  );
  assert.deepEqual(
    (await read(await call(`/packages/${created.id}`), 200)).inclusions,
    ["Decorations"],
  );
  assert.deepEqual(
    (await read(await call(`/packages/${created.id}`), 200)).exclusions,
    [],
  );
  const replacement = await read(
    await call(
      `${path}/draft`,
      "PATCH",
      {
        ...data,
        name: "New name",
        price,
        expectedUpdatedAt: first.published.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(replacement.draft.version, 2);
  assert.equal(
    (
      await pool.query("SELECT price FROM package_versions WHERE id = $1", [
        first.published.id,
      ])
    ).rows[0].price,
    125000,
  );
  assert.equal(
    (await read(await call(`/packages/${created.id}`), 200)).name,
    "Celebration",
  );
  const second = await read(
    await call(
      `${path}/publish`,
      "POST",
      { expectedUpdatedAt: replacement.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    second.versions.find((v: any) => v.version === 1).state,
    "superseded",
  );
  assert.equal(
    (await read(await call(`/packages/${created.id}`), 200)).name,
    "New name",
  );
  await read(await call(path, "DELETE", undefined, adminCookie), 409);
  const pending = await read(
    await call(
      `${path}/draft`,
      "PATCH",
      { ...data, price, expectedUpdatedAt: second.published.updatedAt },
      adminCookie,
    ),
    200,
  );
  await read(
    await call(`${path}/archive`, "POST", undefined, adminCookie),
    200,
  );
  await read(
    await call(
      `${path}/publish`,
      "POST",
      { expectedUpdatedAt: pending.draft.updatedAt },
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `${path}/draft`,
      "PATCH",
      { ...data, price, expectedUpdatedAt: pending.draft.updatedAt },
      adminCookie,
    ),
    409,
  );
  await read(await call(`/packages/${created.id}`), 404);
  assert.equal(
    (await read(await call(path, "GET", undefined, adminCookie), 200)).versions
      .length,
    3,
  );
  const draft = await read(
    await call("/admin/packages", "POST", data, adminCookie),
    201,
  );
  await pool.query(
    "CREATE TABLE test_references (package_id UUID REFERENCES packages(id))",
  );
  await pool.query("INSERT INTO test_references (package_id) VALUES ($1)", [
    draft.id,
  ]);
  await read(
    await call(`/admin/packages/${draft.id}`, "DELETE", undefined, adminCookie),
    409,
  );
  await pool.query("DELETE FROM test_references");
  await read(
    await call(`/admin/packages/${draft.id}`, "DELETE", undefined, adminCookie),
    204,
  );
  await read(
    await call(`/admin/packages/${draft.id}`, "GET", undefined, adminCookie),
    404,
  );
  await read(
    await call(
      path,
      "DELETE",
      undefined,
      adminCookie,
      "https://untrusted.example",
    ),
    403,
  );
  assert.ok(edited.draft.updatedAt !== created.draft.updatedAt);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/packages/{id}/draft"].patch);
});

test("package versions keep external image URLs and reject upload paths", async () => {
  const imageUrl = "https://images.example.test/package.jpg";
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, imageUrl: "/v1/package-images/old" },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, imageUrl: "http://images.example.test/package.jpg" },
      adminCookie,
    ),
    400,
  );
  const created = await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        imageUrl,
        price: { kind: "fixed", currency: "PHP", amountMinor: 100 },
      },
      adminCookie,
    ),
    201,
  );
  const published = await read(
    await call(
      `/admin/packages/${created.id}/publish`,
      "POST",
      { expectedUpdatedAt: created.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    (await read(await call(`/packages/${created.id}`), 200)).imageUrl,
    imageUrl,
  );
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.equal(spec.paths["/v1/admin/package-images"], undefined);
  assert.ok(published.published);
});

const imagePath = (id: string) => `/v1/service-images/${id}`;
async function createUploadedService(content: unknown) {
  const body = new FormData();
  body.set("content", JSON.stringify(content));
  body.set(
    "image",
    new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], {
      type: "image/png",
    }),
    "image.png",
  );
  return read(
    await app.request("/v1/admin/service-uploads", {
      method: "POST",
      headers: { Cookie: adminCookie },
      body,
    }),
    201,
  );
}

test("services and package assignments preserve published versions and protect public catalog", async () => {
  const content = {
    name: "Photography",
    hourlyRatePesos: 500,
    description: "Event coverage",
  };
  await read(await call("/admin/services"), 401);
  await read(
    await call("/admin/services", "POST", content, customerCookie),
    403,
  );
  const created = await createUploadedService(content);
  assert.equal(
    (await read(await call("/services"), 200)).services.some(
      (x: any) => x.id === created.id,
    ),
    false,
  );
  await read(
    await call(
      `/admin/services/${created.id}/publish`,
      "POST",
      { expectedUpdatedAt: created.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  const published = await read(await call(`/services/${created.id}`), 200);
  assert.equal(published.hourlyRatePesos, 500);
  assert.equal("categories" in published, false);
  assert.equal(published.imageId, created.draft.imageId);
  for (const key of [
    "category",
    "coverage",
    "durationMinutes",
    "setupMinutes",
    "setupNeeds",
  ])
    assert.equal(key in published, false);
  const include = {
    serviceVersionId: published.versionId,
    role: "included",
    includedQuantity: 1,
    addOnPrice: null,
    addOnMaxQuantity: null,
  };
  const extra = await createUploadedService({
    ...content,
    name: "Extra coverage",
  });
  const extraPublished = await read(
    await call(
      `/admin/services/${extra.id}/publish`,
      "POST",
      { expectedUpdatedAt: extra.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  const addon = {
    serviceVersionId: extraPublished.published.id,
    role: "add_on",
    includedQuantity: null,
    addOnPrice: { kind: "fixed", currency: "PHP", amountMinor: 250000 },
    addOnMaxQuantity: 2,
  };
  const price = { kind: "fixed", currency: "PHP", amountMinor: 1000000 };
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        price,
        services: [{ ...include, addOnPrice: addon.addOnPrice }],
      },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        price,
        services: [
          { ...addon, addOnPrice: { ...addon.addOnPrice, currency: "USD" } },
        ],
      },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        price,
        services: [
          include,
          { ...addon, serviceVersionId: include.serviceVersionId },
        ],
      },
      adminCookie,
    ),
    400,
  );
  const pkg = await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, inclusions: [], price, services: [include, addon] },
      adminCookie,
    ),
    201,
  );
  assert.match(pkg.draft.services[0].id, /^[0-9a-f-]{36}$/);
  const first = await read(
    await call(
      `/admin/packages/${pkg.id}/publish`,
      "POST",
      { expectedUpdatedAt: pkg.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  const publicPackage = await read(await call(`/packages/${pkg.id}`), 200);
  assert.equal(publicPackage.services.length, 2);
  const nested = publicPackage.services.find(
    (x: any) => x.role === "included",
  ).service;
  assert.equal(nested.hourlyRatePesos, 500);
  assert.equal("categories" in nested, false);
  assert.equal(nested.imageId, created.draft.imageId);
  for (const key of [
    "category",
    "coverage",
    "durationMinutes",
    "setupMinutes",
    "setupNeeds",
  ])
    assert.equal(key in nested, false);
  assert.deepEqual(
    publicPackage.services.find((x: any) => x.role === "add_on").addOnPrice,
    addon.addOnPrice,
  );
  const serviceDraft = await read(
    await call(
      `/admin/services/${created.id}/draft`,
      "PATCH",
      {
        ...content,
        name: "Updated photography",
        expectedUpdatedAt: published.publishedAt,
      },
      adminCookie,
    ),
    200,
  );
  await read(
    await call(
      `/admin/services/${created.id}/publish`,
      "POST",
      { expectedUpdatedAt: serviceDraft.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    (await read(await call(`/packages/${pkg.id}`), 200)).services.find(
      (x: any) => x.role === "included",
    ).service.name,
    "Photography",
  );
  await read(
    await call(
      `/admin/services/${created.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/services/${created.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  const currentService = await read(await call(`/services/${created.id}`), 200);
  const next = await read(
    await call(
      `/admin/packages/${pkg.id}/draft`,
      "PATCH",
      {
        ...data,
        price,
        services: [{ ...include, serviceVersionId: currentService.versionId }],
        expectedUpdatedAt: first.published.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(next.published.services.length, 2);
  assert.equal(next.draft.services.length, 1);
  assert.equal(
    (await read(await call(`/packages/${pkg.id}`), 200)).services.length,
    2,
  );
  await read(
    await call(
      `/admin/packages/${pkg.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  await read(
    await call(
      `/admin/services/${created.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  await read(await call(`/services/${created.id}`), 404);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/services/{id}/publish"].post);
});

test("service JSON requests reject image URLs and paths", async () => {
  const content = {
    name: "Photo",
    hourlyRatePesos: 500,
    description: "Coverage",
  };
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const body = new FormData();
  body.set("content", JSON.stringify(content));
  body.set(
    "image",
    new Blob([Buffer.from(png)], { type: "image/png" }),
    "image.png",
  );
  const created = await read(
    await app.request("/v1/admin/service-uploads", {
      method: "POST",
      headers: { Cookie: adminCookie },
      body,
    }),
    201,
  );
  for (const field of [
    { imageUrl: "https://images.example.test/service.jpg" },
    { imageUrl: imagePath(created.draft.imageId) },
    { imageId: created.draft.imageId },
  ]) {
    await read(
      await call(
        "/admin/services",
        "POST",
        { ...content, ...field },
        adminCookie,
      ),
      400,
    );
    await read(
      await call(
        `/admin/services/${created.id}/draft`,
        "PATCH",
        { ...content, ...field, expectedUpdatedAt: created.draft.updatedAt },
        adminCookie,
      ),
      400,
    );
  }
  const published = await read(
    await call(
      `/admin/services/${created.id}/publish`,
      "POST",
      { expectedUpdatedAt: created.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  const assignment = {
    serviceVersionId: published.published.id,
    role: "included",
    includedQuantity: 1,
    addOnPrice: null,
    addOnMaxQuantity: null,
  };
  const pkg = await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        price: { kind: "fixed", currency: "PHP", amountMinor: 100 },
        services: [assignment],
      },
      adminCookie,
    ),
    201,
  );
  await read(
    await call(
      `/admin/packages/${pkg.id}/publish`,
      "POST",
      { expectedUpdatedAt: pkg.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  const edited = await read(
    await call(
      `/admin/services/${created.id}/draft`,
      "PATCH",
      {
        ...content,
        name: "Revised",
        expectedUpdatedAt: published.published.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(edited.draft.imageId, created.draft.imageId);
  const removed = await read(
    await call(
      `/admin/services/${created.id}/draft`,
      "PATCH",
      {
        ...content,
        removeImage: true,
        expectedUpdatedAt: edited.draft.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(removed.draft.imageId, null);
  assert.equal(
    (await read(await call(`/packages/${pkg.id}`), 200)).services[0].service
      .imageId,
    created.draft.imageId,
  );
  assert.equal(
    (await app.request(imagePath(created.draft.imageId))).status,
    200,
  );
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.equal(
    spec.paths["/v1/admin/services"].post.requestBody.content[
      "application/json"
    ].schema.properties.imageId,
    undefined,
  );
});

test("public catalog pages load 15 at a time and service previews list included packages", async () => {
  const serviceContent = {
    name: "Catalog service",
    hourlyRatePesos: 500,
    description: "For page testing",
  };
  const serviceIds: string[] = [];
  for (let index = 0; index < 16; index++) {
    const created = await createUploadedService({
      ...serviceContent,
      name: `Catalog service ${index}`,
    });
    await read(
      await call(
        `/admin/services/${created.id}/publish`,
        "POST",
        { expectedUpdatedAt: created.draft.updatedAt },
        adminCookie,
      ),
      200,
    );
    serviceIds.push(created.id);
  }
  await read(await call("/services?limit=0"), 400);
  await read(await call("/services?limit=16"), 400);
  await read(await call("/services?limit=15&offset=-1"), 400);
  const firstServices = await read(await call("/services?limit=15"), 200);
  const secondServices = await read(
    await call("/services?limit=15&offset=15"),
    200,
  );
  assert.equal(firstServices.services.length, 15);
  assert.equal(firstServices.nextOffset, 15);
  assert.ok(secondServices.services.length >= 1);
  assert.equal(
    new Set(
      [...firstServices.services, ...secondServices.services].map(
        (row: any) => row.id,
      ),
    ).size,
    firstServices.services.length + secondServices.services.length,
  );
  assert.equal(
    (await read(await call("/services?limit=3"), 200)).services.length,
    3,
  );

  const target = await read(await call(`/services/${serviceIds[0]}`), 200);
  const included = {
    serviceVersionId: target.versionId,
    role: "included",
    includedQuantity: 1,
    addOnPrice: null,
    addOnMaxQuantity: null,
  };
  const addOn = {
    serviceVersionId: target.versionId,
    role: "add_on",
    includedQuantity: null,
    addOnPrice: { kind: "fixed", currency: "PHP", amountMinor: 100 },
    addOnMaxQuantity: 1,
  };
  const price = { kind: "fixed", currency: "PHP", amountMinor: 100000 };
  let includedPackageId = "";
  let addOnPackageId = "";
  for (let index = 0; index < 16; index++) {
    const assignment = index === 0 ? [included] : index === 1 ? [addOn] : [];
    const created = await read(
      await call(
        "/admin/packages",
        "POST",
        {
          ...data,
          name: `Catalog package ${index}`,
          price,
          services: assignment,
        },
        adminCookie,
      ),
      201,
    );
    await read(
      await call(
        `/admin/packages/${created.id}/publish`,
        "POST",
        { expectedUpdatedAt: created.draft.updatedAt },
        adminCookie,
      ),
      200,
    );
    if (index === 0) includedPackageId = created.id;
    if (index === 1) addOnPackageId = created.id;
  }
  await read(await call("/packages?limit=16"), 400);
  const firstPackages = await read(await call("/packages?limit=15"), 200);
  const secondPackages = await read(
    await call("/packages?limit=15&offset=15"),
    200,
  );
  assert.equal(firstPackages.packages.length, 15);
  assert.equal(firstPackages.nextOffset, 15);
  assert.ok(secondPackages.packages.length >= 1);
  assert.equal(
    new Set(
      [...firstPackages.packages, ...secondPackages.packages].map(
        (row: any) => row.id,
      ),
    ).size,
    firstPackages.packages.length + secondPackages.packages.length,
  );
  assert.equal(
    (await read(await call("/packages?limit=3"), 200)).packages.length,
    3,
  );
  const related = await read(
    await call(`/services/${target.id}/packages`),
    200,
  );
  assert.ok(related.packages.some((row: any) => row.id === includedPackageId));
  assert.ok(!related.packages.some((row: any) => row.id === addOnPackageId));
  const serviceAdmin = await read(
    await call(`/admin/services/${target.id}`, "GET", undefined, adminCookie),
    200,
  );
  const revised = await read(
    await call(
      `/admin/services/${target.id}/draft`,
      "PATCH",
      {
        ...serviceContent,
        name: "Revised catalog service",
        expectedUpdatedAt: serviceAdmin.published.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  await read(
    await call(
      `/admin/services/${target.id}/publish`,
      "POST",
      { expectedUpdatedAt: revised.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.ok(
    (
      await read(await call(`/services/${target.id}/packages`), 200)
    ).packages.some((row: any) => row.id === includedPackageId),
  );
  await read(
    await call(
      `/admin/packages/${includedPackageId}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.ok(
    !(
      await read(await call(`/services/${target.id}/packages`), 200)
    ).packages.some((row: any) => row.id === includedPackageId),
  );
  await read(await call(`/services/${randomUUID()}/packages`), 404);
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/services/{id}/packages"].get);
});

test("service rates and image uploads enforce boundaries and preserve history", async () => {
  const content = {
    name: "Photo",
    description: "**Markdown**",
    hourlyRatePesos: null,
  };
  for (const hourlyRatePesos of [0, -1, 1.5, 2147483648])
    await read(
      await call(
        "/admin/services",
        "POST",
        { ...content, hourlyRatePesos },
        adminCookie,
      ),
      400,
    );
  const unrated = await read(
    await call("/admin/services", "POST", { ...content }, adminCookie),
    201,
  );
  await read(
    await call(
      `/admin/services/${unrated.id}/publish`,
      "POST",
      { expectedUpdatedAt: unrated.draft.updatedAt },
      adminCookie,
    ),
    400,
  );
  const imageless = await read(
    await call(
      "/admin/services",
      "POST",
      { ...content, hourlyRatePesos: 300 },
      adminCookie,
    ),
    201,
  );
  await read(
    await call(
      `/admin/services/${imageless.id}/publish`,
      "POST",
      { expectedUpdatedAt: imageless.draft.updatedAt },
      adminCookie,
    ),
    400,
  );
  function form(value: unknown, bytes: Uint8Array, type: string) {
    const body = new FormData();
    body.set("content", JSON.stringify(value));
    body.set("image", new Blob([Buffer.from(bytes)], { type }), "image");
    return body;
  }
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  async function upload(
    path: string,
    method: string,
    body: FormData,
    cookie?: string,
    origin?: string,
  ) {
    return app.request(`/v1${path}`, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body,
    });
  }
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, png, "image/png"),
    ),
    401,
  );
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, png, "image/png"),
      customerCookie,
    ),
    403,
  );
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, png, "image/png"),
      adminCookie,
      "https://other.example",
    ),
    403,
  );
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, new Uint8Array([1, 2, 3]), "image/png"),
      adminCookie,
    ),
    400,
  );
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, png, "image/jpeg"),
      adminCookie,
    ),
    400,
  );
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, new Uint8Array(10 * 1024 * 1024 + 1), "image/png"),
      adminCookie,
    ),
    413,
  );
  const jpeg = new Uint8Array([255, 216, 255, 0]);
  const webp = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, jpeg, "image/jpeg"),
      adminCookie,
    ),
    201,
  );
  await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form(content, webp, "image/webp"),
      adminCookie,
    ),
    201,
  );
  const created = await read(
    await upload(
      "/admin/service-uploads",
      "POST",
      form({ ...content, hourlyRatePesos: 500 }, png, "image/png"),
      adminCookie,
    ),
    201,
  );
  assert.match(created.draft.imageId, /^[0-9a-f-]{36}$/);
  const retrieved = await app.request(imagePath(created.draft.imageId));
  assert.equal(retrieved.status, 200);
  assert.equal(retrieved.headers.get("content-type"), "image/png");
  assert.deepEqual(new Uint8Array(await retrieved.arrayBuffer()), png);
  const published = await read(
    await call(
      `/admin/services/${created.id}/publish`,
      "POST",
      { expectedUpdatedAt: created.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  const count = storedImages.size;
  await read(
    await upload(
      `/admin/service-uploads/${created.id}`,
      "PATCH",
      form(
        {
          ...content,
          hourlyRatePesos: 600,
          expectedUpdatedAt: created.draft.updatedAt,
        },
        png,
        "image/png",
      ),
      adminCookie,
    ),
    409,
  );
  assert.equal(storedImages.size, count);
  const updated = await read(
    await upload(
      `/admin/service-uploads/${created.id}`,
      "PATCH",
      form(
        {
          ...content,
          hourlyRatePesos: 600,
          expectedUpdatedAt: published.published.updatedAt,
        },
        png,
        "image/png",
      ),
      adminCookie,
    ),
    200,
  );
  assert.equal(updated.published.imageId, created.draft.imageId);
  assert.notEqual(updated.draft.imageId, updated.published.imageId);
  assert.equal(updated.published.hourlyRatePesos, 500);
  assert.equal(updated.draft.hourlyRatePesos, 600);
  assert.equal(
    (await app.request(imagePath(updated.published.imageId))).status,
    200,
  );
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/service-uploads"].post);
  assert.ok(spec.paths["/v1/admin/service-uploads/{id}"].patch);
  assert.ok(spec.paths["/v1/service-images/{id}"].get);
});

test("unreferenced draft uploads are cleaned up and historical images survive", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const content = {
    name: "Cleanup",
    description: "Description",
    hourlyRatePesos: 300,
  };
  const upload = async (path: string, method: string, value: unknown) => {
    const body = new FormData();
    body.set("content", JSON.stringify(value));
    body.set(
      "image",
      new Blob([Buffer.from(png)], { type: "image/png" }),
      "test.png",
    );
    return app.request(`/v1${path}`, {
      method,
      headers: { Cookie: adminCookie },
      body,
    });
  };
  const first = await read(
    await upload("/admin/service-uploads", "POST", content),
    201,
  );
  const firstImage = first.draft.imageId;
  const second = await read(
    await upload(`/admin/service-uploads/${first.id}`, "PATCH", {
      ...content,
      expectedUpdatedAt: first.draft.updatedAt,
    }),
    200,
  );
  assert.equal((await app.request(imagePath(firstImage))).status, 404);
  const secondImage = second.draft.imageId;
  const noImage = await read(
    await call(
      `/admin/services/${first.id}/draft`,
      "PATCH",
      {
        ...content,
        removeImage: true,
        expectedUpdatedAt: second.draft.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal((await app.request(imagePath(secondImage))).status, 404);
  await read(
    await call(
      "/admin/services",
      "POST",
      { ...content, imageId: secondImage },
      adminCookie,
    ),
    400,
  );
  const third = await read(
    await upload(`/admin/service-uploads/${first.id}`, "PATCH", {
      ...content,
      expectedUpdatedAt: noImage.draft.updatedAt,
    }),
    200,
  );
  const thirdImage = third.draft.imageId;
  await read(
    await call(`/admin/services/${first.id}`, "DELETE", undefined, adminCookie),
    204,
  );
  assert.equal((await app.request(imagePath(thirdImage))).status, 404);
  const historical = await read(
    await upload("/admin/service-uploads", "POST", content),
    201,
  );
  const published = await read(
    await call(
      `/admin/services/${historical.id}/publish`,
      "POST",
      { expectedUpdatedAt: historical.draft.updatedAt },
      adminCookie,
    ),
    200,
  );
  const replacement = await read(
    await upload(`/admin/service-uploads/${historical.id}`, "PATCH", {
      ...content,
      expectedUpdatedAt: published.published.updatedAt,
    }),
    200,
  );
  await read(
    await call(
      `/admin/services/${historical.id}/draft`,
      "PATCH",
      {
        ...content,
        removeImage: true,
        expectedUpdatedAt: replacement.draft.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    (await app.request(imagePath(historical.draft.imageId))).status,
    200,
  );
  assert.equal(
    (await app.request(imagePath(replacement.draft.imageId))).status,
    404,
  );
  await read(
    await call(
      `/admin/services/${historical.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  assert.equal(
    (await app.request(imagePath(historical.draft.imageId))).status,
    200,
  );
});

test("a storage cleanup failure does not reverse a committed edit or deletion", async () => {
  const content = {
    name: "Failure handling",
    description: "Description",
    hourlyRatePesos: 300,
  };
  const upload = async () => {
    const body = new FormData();
    body.set("content", JSON.stringify(content));
    body.set(
      "image",
      new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], {
        type: "image/png",
      }),
      "image.png",
    );
    return read(
      await app.request("/v1/admin/service-uploads", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body,
      }),
      201,
    );
  };
  const first = await upload();
  const second = await upload();
  failStorageDeletes = true;
  try {
    const edited = await read(
      await call(
        `/admin/services/${first.id}/draft`,
        "PATCH",
        {
          ...content,
          removeImage: true,
          expectedUpdatedAt: first.draft.updatedAt,
        },
        adminCookie,
      ),
      200,
    );
    assert.equal(edited.draft.imageId, null);
    await read(
      await call(
        `/admin/services/${second.id}`,
        "DELETE",
        undefined,
        adminCookie,
      ),
      204,
    );
    await read(
      await call(`/admin/services/${second.id}`, "GET", undefined, adminCookie),
      404,
    );
    assert.equal(
      (await app.request(imagePath(first.draft.imageId))).status,
      200,
    );
    assert.equal(
      (await app.request(imagePath(second.draft.imageId))).status,
      200,
    );
  } finally {
    failStorageDeletes = false;
  }
});
