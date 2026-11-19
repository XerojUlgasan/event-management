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
let otherCustomerCookie: string;
let customerCookie: string;
let storageServer: Server;
let failStorageDeletes = false;
let failStorageWrites = false;
let missingStorageGetAs400 = false;
let beforeStorageGet:
  { path: string; callback: () => Promise<void> } | undefined;
const storedImages = new Map<string, { bytes: Buffer; contentType: string }>();

before(async () => {
  // Catalog regressions must not schedule requests to a live AI provider.
  delete process.env.AI_GATEWAY_API_KEY;
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
    if (req.method === "POST" || req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      if (failStorageWrites) {
        res.statusCode = 503;
        res.end();
        return;
      }
      if (
        storedImages.has(path) &&
        String(req.headers["x-upsert"]).toLowerCase() !== "true"
      ) {
        res.statusCode = 409;
        res.end();
        return;
      }
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
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const payload = Buffer.concat(chunks).toString();
        if (payload) {
          const prefixes =
            (JSON.parse(payload) as { prefixes?: string[] }).prefixes ?? [];
          for (const prefix of prefixes) {
            const encoded = prefix
              .split("/")
              .map((segment) => encodeURIComponent(segment))
              .join("/");
            storedImages.delete(`${path}/${encoded}`);
          }
        } else storedImages.delete(path);
        res.statusCode = 204;
        res.end();
      }
    } else {
      if (beforeStorageGet?.path === path) {
        const callback = beforeStorageGet.callback;
        beforeStorageGet = undefined;
        await callback();
      }
      const image = storedImages.get(path);
      if (!image) {
        if (missingStorageGetAs400) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ code: "NoSuchKey", statusCode: "404" }));
        } else {
          res.statusCode = 404;
          res.end();
        }
      } else {
        res.setHeader("Content-Type", image.contentType);
        const range = req.headers.range?.match(/^bytes=(\d+)-(\d+)$/);
        if (range) {
          const start = Number(range[1]),
            end = Number(range[2]);
          res.statusCode = 206;
          res.setHeader(
            "Content-Range",
            `bytes ${start}-${end}/${image.bytes.length}`,
          );
          res.setHeader("Content-Length", end - start + 1);
          res.end(image.bytes.subarray(start, end + 1));
        } else {
          res.setHeader("Content-Length", image.bytes.length);
          res.end(image.bytes);
        }
      }
    }
  });
  await new Promise<void>((resolve) =>
    storageServer.listen(0, "127.0.0.1", resolve),
  );
  const address = storageServer.address();
  assert.ok(address && typeof address !== "string");
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
  process.env.SUPABASE_STORAGE_BUCKET = "test";
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  async function session(role: string) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${role}-${randomUUID()}@example.test`,
        password_hash: "unused",
        role,
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
  adminCookie = await session("admin");
  otherCustomerCookie = await session("customer");
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
    for (let attempt = 0; attempt < 100; attempt++) {
      const active = await admin.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1",
        [database],
      );
      if (active.rows[0].count === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
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
  description: "An elegant celebration with thoughtful details.",
  maxGuests: 100,
  price: { kind: "fixed", currency: "PHP", amountMinor: 12000000 },
  sections: [
    {
      id: randomUUID(),
      title: "The experience",
      widgets: [
        {
          id: randomUUID(),
          type: "photo",
          x: 0,
          y: 0,
          w: 6,
          h: 6,
          markdown: "",
          media: {
            kind: "image",
            source: "sample",
            url: "/images/wedding.jpg",
          },
          alt: "Table setting",
          caption: "",
        },
        {
          id: randomUUID(),
          type: "markdown",
          x: 6,
          y: 0,
          w: 6,
          h: 6,
          markdown: "## An occasion\n\nA **beautiful** celebration",
          media: null,
          alt: "",
          caption: "",
        },
      ],
    },
  ],
};
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}

async function createServiceWithPhoto(content: unknown) {
  const media = await read(
    await uploadCanvas(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      "image/png",
    ),
    201,
  );
  return read(
    await call(
      "/admin/services",
      "POST",
      {
        fixedPricePesos: null,
        includedHours: null,
        ...(content as object),
        sections: [
          {
            id: randomUUID(),
            title: "",
            widgets: [
              {
                id: randomUUID(),
                type: "photo",
                x: 0,
                y: 0,
                w: 12,
                h: 6,
                markdown: "",
                media,
                alt: "Service photo",
                caption: "",
              },
            ],
          },
        ],
      },
      adminCookie,
    ),
    201,
  );
}

test("services save directly, validate complete content, and enforce permissions", async () => {
  const content = {
    name: "Photo",
    description: "Coverage",
    hourlyRatePesos: 500,
    fixedPricePesos: null,
    includedHours: null,
  };
  await read(await call("/admin/services", "POST", content), 401);
  for (const cookie of [customerCookie, otherCustomerCookie])
    await read(await call("/admin/services", "POST", content, cookie), 403);
  for (const hourlyRatePesos of [null, 0, -1, 1.5, 2147483648])
    await read(
      await call(
        "/admin/services",
        "POST",
        { ...content, hourlyRatePesos },
        adminCookie,
      ),
      400,
    );
  await read(await call("/admin/services", "POST", content, adminCookie), 400);
  const created = await createServiceWithPhoto(content);
  assert.equal(created.name, content.name);
  assert.equal(created.hourlyRatePesos, 500);
  assert.equal("imageId" in created, false);
  assert.equal(created.imageUrl, null);
  assert.ok(created.publishedAt);
  for (const key of ["draft", "published", "versions", "version", "state"])
    assert.equal(key in created, false);
  assert.equal(
    (await read(await call(`/services/${created.id}`), 200)).name,
    content.name,
  );
  for (const field of [
    { imageUrl: "https://example.test/image.jpg" },
    { imageId: randomUUID() },
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
        `/admin/services/${created.id}`,
        "PATCH",
        { ...content, ...field, expectedUpdatedAt: created.updatedAt },
        adminCookie,
      ),
      400,
    );
  }
  const edited = await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...content, name: "Changed", expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    (await read(await call(`/services/${created.id}`), 200)).name,
    "Changed",
  );
  await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...content, expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...content, removeImage: true, expectedUpdatedAt: edited.updatedAt },
      adminCookie,
    ),
    400,
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
  await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...content, expectedUpdatedAt: edited.updatedAt },
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
    204,
  );
  await read(
    await call(`/admin/services/${created.id}`, "GET", undefined, adminCookie),
    404,
  );
  for (const route of ["draft", "publish"])
    assert.equal(
      (
        await call(
          `/admin/services/${created.id}/${route}`,
          route === "draft" ? "PATCH" : "POST",
          {},
          adminCookie,
        )
      ).status,
      404,
    );
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/services/{id}"].patch);
  assert.equal(spec.paths["/v1/admin/services/{id}/draft"], undefined);
  assert.equal(spec.paths["/v1/admin/services/{id}/publish"], undefined);
});

test("service pricing validates and switches between fixed and hourly modes", async () => {
  const hourly = {
    name: "Pricing service",
    description: "Coverage",
    hourlyRatePesos: 500,
    fixedPricePesos: null,
    includedHours: null,
  };
  const created = await createServiceWithPhoto(hourly);
  const fixedCreated = await createServiceWithPhoto({
    ...hourly,
    name: "Fixed pricing service",
    fixedPricePesos: 3000,
    includedHours: 3,
  });
  assert.deepEqual(
    [
      fixedCreated.fixedPricePesos,
      fixedCreated.includedHours,
      fixedCreated.hourlyRatePesos,
    ],
    [3000, 3, 500],
  );
  for (const pricing of [
    { fixedPricePesos: 2000, includedHours: null },
    { fixedPricePesos: null, includedHours: 2 },
    { fixedPricePesos: 0, includedHours: 2 },
    { fixedPricePesos: 2000, includedHours: 0 },
    { fixedPricePesos: 2000, includedHours: 1.5 },
    { fixedPricePesos: 2000, includedHours: 2, hourlyRatePesos: null },
  ]) {
    await read(
      await call(
        "/admin/services",
        "POST",
        {
          ...hourly,
          ...pricing,
          sections: created.sections,
        },
        adminCookie,
      ),
      400,
    );
    await read(
      await call(
        `/admin/services/${created.id}`,
        "PATCH",
        {
          ...hourly,
          ...pricing,
          expectedUpdatedAt: created.updatedAt,
        },
        adminCookie,
      ),
      400,
    );
  }
  const { fixedPricePesos: omitted, ...missingFixed } = hourly;
  await read(
    await call(
      "/admin/services",
      "POST",
      {
        ...missingFixed,
        sections: created.sections,
      },
      adminCookie,
    ),
    400,
  );
  const { includedHours: omittedHours, ...missingHours } = hourly;
  await read(
    await call(
      "/admin/services",
      "POST",
      {
        ...missingHours,
        sections: created.sections,
      },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      {
        ...missingFixed,
        expectedUpdatedAt: created.updatedAt,
      },
      adminCookie,
    ),
    400,
  );
  const fixed = await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      {
        ...hourly,
        fixedPricePesos: 2000,
        includedHours: 2,
        expectedUpdatedAt: created.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  const publicFixed = await read(await call(`/services/${created.id}`), 200);
  assert.deepEqual(
    [
      publicFixed.fixedPricePesos,
      publicFixed.includedHours,
      publicFixed.hourlyRatePesos,
    ],
    [2000, 2, 500],
  );
  const persisted = await pool.query(
    "SELECT fixed_price_pesos, included_hours, hourly_rate_pesos FROM services WHERE id=$1",
    [created.id],
  );
  assert.deepEqual(persisted.rows[0], {
    fixed_price_pesos: 2000,
    included_hours: 2,
    hourly_rate_pesos: 500,
  });
  const backToHourly = await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      {
        ...hourly,
        expectedUpdatedAt: fixed.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.deepEqual(
    [
      backToHourly.fixedPricePesos,
      backToHourly.includedHours,
      backToHourly.hourlyRatePesos,
    ],
    [null, null, 500],
  );
});

test("service canvas photos replace legacy image uploads and clean up removed media", async () => {
  const content = {
    name: "Uploaded service",
    description: "Description",
    hourlyRatePesos: 300,
    fixedPricePesos: null,
    includedHours: null,
  };
  const created = await createServiceWithPhoto(content);
  const oldPhoto = created.sections[0].widgets[0].media;
  const newPhoto = await read(
    await uploadCanvas(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      "image/png",
    ),
    201,
  );
  const sections = structuredClone(created.sections);
  sections[0].widgets[0].media = newPhoto;
  const edited = await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...content, sections, expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    (await read(await call(`/services/${created.id}`), 200)).imageUrl,
    null,
  );
  assert.equal((await app.request(oldPhoto.url)).status, 404);
  await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...content, sections, expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...content, sections: [], expectedUpdatedAt: edited.updatedAt },
      adminCookie,
    ),
    400,
  );
  assert.equal((await app.request(newPhoto.url)).status, 200);
  await read(
    await call(
      `/admin/services/${created.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  assert.equal((await app.request(newPhoto.url)).status, 404);
  for (const [path, method] of [
    ["/admin/service-uploads", "POST"],
    [`/admin/service-uploads/${created.id}`, "PATCH"],
    [`/service-images/${randomUUID()}`, "GET"],
  ]) {
    assert.equal(
      (
        await app.request(`/v1${path}`, {
          method,
          headers: { Cookie: adminCookie },
        })
      ).status,
      404,
    );
  }
  const spec: any = await (await app.request("/openapi.json")).json();
  for (const path of [
    "/v1/admin/service-uploads",
    "/v1/admin/service-uploads/{id}",
    "/v1/service-images/{id}",
  ])
    assert.equal(spec.paths[path], undefined);
  const input =
    spec.paths["/v1/admin/services"].post.requestBody.content[
      "application/json"
    ].schema;
  const output =
    spec.paths["/v1/admin/services"].post.responses["201"].content[
      "application/json"
    ].schema;
  assert.equal("imageId" in input.properties, false);
  assert.equal("imageId" in output.properties, false);
});

test("canvas saves publish atomically and protect concurrent edits", async () => {
  await read(await call("/admin/packages"), 401);
  for (const cookie of [customerCookie, otherCustomerCookie])
    await read(await call("/admin/packages", "POST", data, cookie), 403);
  for (const patch of [
    { name: "" },
    { price: null },
    { price: { ...data.price, amountMinor: 101 } },
    { maxGuests: 0 },
    { eventTypes: ["Birthday"] },
    { guestMax: 100 },
    { services: [] },
  ])
    await read(
      await call("/admin/packages", "POST", { ...data, ...patch }, adminCookie),
      400,
    );
  const gridContent = structuredClone(data);
  Object.assign(gridContent.sections[0].widgets[0], { x: 0, y: 2, w: 4, h: 8 });
  Object.assign(gridContent.sections[0].widgets[1], {
    x: 7,
    y: 14,
    w: 5,
    h: 3,
  });
  const expectedGeometry = [
    [0, 2, 4, 8],
    [7, 14, 5, 3],
  ];
  const geometry = (item: any) =>
    item.sections[0].widgets.map(({ x, y, w, h }: any) => [x, y, w, h]);
  const created = await read(
    await call("/admin/packages", "POST", gridContent, adminCookie),
    201,
  );
  assert.equal(created.name, data.name);
  assert.equal(created.description, data.description);
  assert.equal(created.imageUrl, null);
  for (const key of [
    "draft",
    "published",
    "versions",
    "versionId",
    "eventTypes",
    "guestMax",
    "services",
  ])
    assert.equal(key in created, false);
  const detail = await read(await call(`/packages/${created.id}`), 200);
  assert.equal("services" in detail, false);
  assert.equal(detail.sections[0].widgets.length, 2);
  assert.deepEqual(geometry(detail), expectedGeometry);
  await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      { ...gridContent, services: [], expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    400,
  );
  const edits = await Promise.all(
    ["First edit", "Second edit"].map((name) =>
      call(
        `/admin/packages/${created.id}`,
        "PATCH",
        { ...gridContent, name, expectedUpdatedAt: created.updatedAt },
        adminCookie,
      ),
    ),
  );
  assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
  const current = await read(
    await call(`/admin/packages/${created.id}`, "GET", undefined, adminCookie),
    200,
  );
  assert.deepEqual(geometry(current), expectedGeometry);
  assert.deepEqual(
    geometry(await read(await call(`/packages/${created.id}`), 200)),
    expectedGeometry,
  );
  const before = (
    await pool.query("SELECT canvas FROM packages WHERE id=$1", [created.id])
  ).rows[0].canvas;
  const bad = structuredClone(data);
  bad.sections[0].widgets[0].media = {
    kind: "image",
    source: "upload",
    id: randomUUID(),
    url: "/v1/catalog-media/missing",
  } as any;
  await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      { ...bad, name: "Must roll back", expectedUpdatedAt: current.updatedAt },
      adminCookie,
    ),
    400,
  );
  assert.equal(
    (await read(await call(`/packages/${created.id}`), 200)).name,
    current.name,
  );
  assert.deepEqual(
    (await pool.query("SELECT canvas FROM packages WHERE id=$1", [created.id]))
      .rows[0].canvas,
    before,
  );
  assert.equal(
    (
      await call(
        `/admin/packages/${created.id}/draft`,
        "PATCH",
        data,
        adminCookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call(
        `/admin/packages/${created.id}/publish`,
        "POST",
        {},
        adminCookie,
      )
    ).status,
    404,
  );
  assert.equal((await call(`/services/${randomUUID()}/packages`)).status, 404);
  const archived = await read(
    await call(
      `/admin/packages/${created.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.ok(archived.archivedAt);
  await read(await call(`/packages/${created.id}`), 404);
  await read(
    await call(
      `/admin/packages/${created.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  assert.equal(
    (
      await pool.query("SELECT count(*) FROM packages WHERE id=$1", [
        created.id,
      ])
    ).rows[0].count,
    "0",
  );
});

test("package descriptions are stored independently from canvas text and enforce catalog limits", async () => {
  const created = await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, description: "  A description for the card.  " },
      adminCookie,
    ),
    201,
  );
  assert.equal(created.description, "A description for the card.");
  assert.equal(
    (
      await pool.query("SELECT description FROM packages WHERE id=$1", [
        created.id,
      ])
    ).rows[0].description,
    created.description,
  );
  const { description: omitted, ...legacyContent } = data;
  const changedCanvas = structuredClone(legacyContent);
  changedCanvas.sections[0].widgets[1].markdown = "## Different canvas text";
  const edited = await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      { ...changedCanvas, expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(edited.description, created.description);
  assert.equal(
    (await read(await call(`/packages/${created.id}`), 200)).description,
    created.description,
  );
  assert.equal(
    (await read(await call("/packages"), 200)).packages.find(
      (item: any) => item.id === created.id,
    ).description,
    created.description,
  );
  const limit = "x".repeat(4000);
  const boundary = await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      { ...data, description: limit, expectedUpdatedAt: edited.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(boundary.description, limit);
  await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      {
        ...data,
        description: limit + "x",
        expectedUpdatedAt: boundary.updatedAt,
      },
      adminCookie,
    ),
    400,
  );
  const cleared = await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      { ...data, description: "", expectedUpdatedAt: boundary.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(cleared.description, "");
  assert.equal(
    (await read(await call(`/packages/${created.id}`), 200)).description,
    "",
  );
  const textOnly = await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        name: "Text-only package",
        description: "Card text without canvas widgets",
        sections: [],
      },
      adminCookie,
    ),
    201,
  );
  assert.equal(textOnly.description, "Card text without canvas widgets");
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, description: limit + "x" },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, description: null },
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      `/admin/packages/${created.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  await read(
    await call(
      `/admin/packages/${textOnly.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
});

test("catalog validates widget sources, bounds, counts and paginates direct packages", async () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.test/a.mp4",
    "https://youtube.com/watch?v=bad",
    "https://example.test/page",
    "https://example.test/film.mp4",
    "https://youtu.be/aqz-KE-bpKQ",
    "https://vimeo.com/123456",
  ]) {
    const c = structuredClone(data);
    c.sections[0].widgets[0] = {
      ...c.sections[0].widgets[0],
      type: "video",
      media: { kind: "video", source: "external", url },
    };
    await read(await call("/admin/packages", "POST", c, adminCookie), 400);
  }
  const linkedPhoto = structuredClone(data);
  linkedPhoto.sections[0].widgets[0].media = {
    kind: "image",
    source: "external",
    url: "https://example.test/photo.jpg",
  };
  await read(
    await call("/admin/packages", "POST", linkedPhoto, adminCookie),
    400,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO media_assets(kind,source,url) VALUES('image','external','https://example.test/photo.jpg')",
    ),
    /media_assets_source/,
  );
  const { MAX_CATALOG_WIDGET_ROWS, MAX_CATALOG_WIDGET_Y } =
    await import("@event-management/contracts/limits/catalog");
  assert.equal(MAX_CATALOG_WIDGET_ROWS, 100);
  assert.equal(MAX_CATALOG_WIDGET_Y, 100000);
  const maxGeometry = structuredClone(data);
  maxGeometry.name = `Maximum grid ${randomUUID()}`;
  Object.assign(maxGeometry.sections[0].widgets[0], {
    y: MAX_CATALOG_WIDGET_Y,
    h: MAX_CATALOG_WIDGET_ROWS,
  });
  const maxGeometrySaved = await read(
    await call("/admin/packages", "POST", maxGeometry, adminCookie),
    201,
  );
  assert.deepEqual(
    maxGeometrySaved.sections[0].widgets.map((widget: any) => [
      widget.y,
      widget.h,
    ]),
    [
      [MAX_CATALOG_WIDGET_Y, MAX_CATALOG_WIDGET_ROWS],
      [0, 6],
    ],
  );
  await read(
    await call(
      `/admin/packages/${maxGeometrySaved.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  for (const invalidGeometry of [
    { x: 11, w: 2 },
    { h: MAX_CATALOG_WIDGET_ROWS + 1 },
    { y: MAX_CATALOG_WIDGET_Y + 1 },
    { w: 0 },
  ]) {
    const c = structuredClone(data);
    Object.assign(c.sections[0].widgets[0], invalidGeometry);
    await read(await call("/admin/packages", "POST", c, adminCookie), 400);
  }
  const c = structuredClone(data);
  c.sections[0].widgets.push({ ...c.sections[0].widgets[0] });
  await read(await call("/admin/packages", "POST", c, adminCookie), 400);
  const countBefore = (await read(await call("/packages?limit=50"), 200))
    .packages.length;
  for (let i = 0; i < 17; i++)
    await read(
      await call(
        "/admin/packages",
        "POST",
        { ...data, name: `Paged ${i}` },
        adminCookie,
      ),
      201,
    );
  const first = await read(await call("/packages?limit=15"), 200);
  assert.equal(first.packages.length, 15);
  assert.ok(first.nextCursor);
  const second = await read(
    await call(
      `/packages?limit=15&cursor=${encodeURIComponent(first.nextCursor)}`,
    ),
    200,
  );
  assert.equal(second.packages.length, countBefore + 2);
  assert.equal(second.nextCursor, null);
  const ids = [...first.packages, ...second.packages].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  await read(await call("/packages?limit=51"), 400);
  await read(await call("/packages?cursor=invalid"), 400);
});

test("service pages preserve microsecond boundaries and filter scope", async () => {
  const created = [];
  for (let i = 0; i < 3; i++)
    created.push(
      await createServiceWithPhoto({
        name: `Cursor service ${i}`,
        description: "Pagination proof",
        hourlyRatePesos: 500,
      }),
    );
  for (let i = 0; i < created.length; i++)
    await pool.query(
      "UPDATE services SET created_at = $1::timestamptz, published_at = $1::timestamptz WHERE id = $2",
      [`2026-01-01T00:00:00.00000${i + 1}Z`, created[i].id],
    );
  const first = await read(
    await call(
      "/admin/services?limit=1&archived=active&search=Cursor%20service",
      "GET",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.equal(first.counts.filtered, 3);
  assert.ok(first.nextCursor);
  const forged = JSON.parse(
    Buffer.from(first.nextCursor, "base64url").toString("utf8"),
  );
  forged.position.sort = "0000-01-01T00:00:00.000001Z";
  const forgedCursor = Buffer.from(JSON.stringify(forged)).toString(
    "base64url",
  );
  await read(
    await call(
      `/admin/services?limit=1&archived=active&search=Cursor%20service&cursor=${forgedCursor}`,
      "GET",
      undefined,
      adminCookie,
    ),
    400,
  );
  await read(
    await call(
      `/admin/services/${first.services[0].id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  const second = await read(
    await call(
      `/admin/services?limit=1&archived=active&search=Cursor%20service&cursor=${encodeURIComponent(first.nextCursor)}`,
      "GET",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.equal(second.services.length, 1);
  assert.notEqual(second.services[0].id, first.services[0].id);
  const third = await read(
    await call(
      `/admin/services?limit=1&archived=active&search=Cursor%20service&cursor=${encodeURIComponent(second.nextCursor)}`,
      "GET",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.equal(third.services.length, 1);
  assert.notEqual(third.services[0].id, second.services[0].id);
  assert.equal(third.nextCursor, null);
  await read(
    await call(
      `/admin/services?limit=1&archived=active&search=other&cursor=${encodeURIComponent(first.nextCursor)}`,
      "GET",
      undefined,
      adminCookie,
    ),
    400,
  );
  for (const service of [second.services[0], third.services[0]])
    await read(
      await call(
        `/admin/services/${service.id}`,
        "DELETE",
        undefined,
        adminCookie,
      ),
      204,
    );
});

test("public package and service filters apply before pagination", async () => {
  const packages = [];
  for (const [index, price, guests] of [
    [0, 765000, 100],
    [1, 765000, 150],
    [2, 765001, 200],
  ]) {
    packages.push(
      await read(
        await call(
          "/admin/packages",
          "POST",
          {
            ...data,
            name: `Filter package ${index}`,
            maxGuests: guests,
            price: { ...data.price, amountMinor: price * 100 },
          },
          adminCookie,
        ),
        201,
      ),
    );
  }
  const first = await read(
    await call(
      "/packages?limit=1&minPricePesos=765000&maxPricePesos=765000&guests=100",
    ),
    200,
  );
  assert.equal(first.packages.length, 1);
  assert.ok(first.nextCursor);
  const next = await read(
    await call(
      `/packages?limit=1&minPricePesos=765000&maxPricePesos=765000&guests=100&cursor=${encodeURIComponent(first.nextCursor)}`,
    ),
    200,
  );
  assert.deepEqual(
    new Set([first.packages[0].id, next.packages[0].id]),
    new Set(packages.slice(0, 2).map((p) => p.id)),
  );
  assert.equal(next.nextCursor, null);
  const guestResult = await read(
    await call(
      "/packages?minPricePesos=765000&maxPricePesos=765001&guests=151",
    ),
    200,
  );
  assert.deepEqual(
    guestResult.packages.map((p: { id: string }) => p.id),
    [packages[2].id],
  );
  await read(
    await call(
      `/packages?minPricePesos=765000&maxPricePesos=765000&guests=101&cursor=${encodeURIComponent(first.nextCursor)}`,
    ),
    400,
  );

  const services: { id: string }[] = [];
  for (const [index, rate] of [
    [0, 765000],
    [1, 765000],
    [2, 765001],
  ]) {
    services.push(
      await createServiceWithPhoto({
        name: `Filter service ${index}`,
        description: "Filter test",
        hourlyRatePesos: rate,
      }),
    );
  }
  await pool.query(
    "UPDATE services SET hourly_rate_pesos = NULL WHERE id = $1",
    [services[2].id],
  );
  const servicePage = await read(
    await call(
      "/services?pricingType=hourly&limit=1&minPricePesos=765000&maxPricePesos=765000",
    ),
    200,
  );
  assert.ok(servicePage.nextCursor);
  const serviceNext = await read(
    await call(
      `/services?pricingType=hourly&limit=1&minPricePesos=765000&maxPricePesos=765000&cursor=${encodeURIComponent(servicePage.nextCursor)}`,
    ),
    200,
  );
  assert.deepEqual(
    new Set([servicePage.services[0].id, serviceNext.services[0].id]),
    new Set(services.slice(0, 2).map((s) => s.id)),
  );
  assert.equal(serviceNext.nextCursor, null);
  await read(
    await call(
      `/services?pricingType=hourly&minPricePesos=765001&cursor=${encodeURIComponent(servicePage.nextCursor)}`,
    ),
    400,
  );
  const fixedServices = [];
  for (const index of [0, 1])
    fixedServices.push(
      await createServiceWithPhoto({
        name: `Filter fixed service ${index}`,
        description: "Filter test",
        fixedPricePesos: 765000,
        includedHours: 6,
        hourlyRatePesos: 12,
      }),
    );
  const fixedPage = await read(
    await call(
      "/services?pricingType=fixed&limit=1&minPricePesos=765000&maxPricePesos=765000",
    ),
    200,
  );
  assert.equal(fixedPage.services.length, 1);
  assert.ok(fixedPage.nextCursor);
  const fixedNext = await read(
    await call(
      `/services?pricingType=fixed&limit=1&minPricePesos=765000&maxPricePesos=765000&cursor=${encodeURIComponent(fixedPage.nextCursor)}`,
    ),
    200,
  );
  assert.deepEqual(
    new Set([fixedPage.services[0].id, fixedNext.services[0].id]),
    new Set(fixedServices.map((s) => s.id)),
  );
  assert.equal(fixedNext.nextCursor, null);
  await read(
    await call(
      `/services?pricingType=hourly&limit=1&minPricePesos=765000&maxPricePesos=765000&cursor=${encodeURIComponent(fixedPage.nextCursor)}`,
    ),
    400,
  );
  const hourlyWithSmallRate = await read(
    await call(
      "/services?pricingType=hourly&minPricePesos=12&maxPricePesos=12",
    ),
    200,
  );
  assert.ok(
    hourlyWithSmallRate.services.every(
      (s: { fixedPricePesos: number | null }) => s.fixedPricePesos === null,
    ),
  );
  for (const query of [
    "minPricePesos=765000",
    "pricingType=unknown",
    "pricingType=fixed&minPricePesos=2&maxPricePesos=1",
    "pricingType=hourly&minPricePesos=1.5",
  ])
    await read(await call(`/services?${query}`), 400);
  const unfiltered = await read(await call("/services?limit=50"), 200);
  assert.ok(
    unfiltered.services.some((s: { id: string }) => s.id === services[2].id),
  );
  for (const query of [
    "minPricePesos=",
    "maxPricePesos=-1",
    "minPricePesos=1.5",
    "guests=0",
    "guests=2147483648",
    "minPricePesos=2&maxPricePesos=1",
    "maxPricePesos=2147483648",
  ]) {
    await read(await call(`/packages?${query}`), 400);
  }
  await read(await call("/services?guests=10"), 400);
});

async function uploadCanvas(
  bytes: Uint8Array,
  mime: string,
  cookie = adminCookie,
) {
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(bytes)], { type: mime }), "media");
  return app.request("/v1/admin/catalog-media", {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
}

function storageObjectPath(key: string) {
  return `/storage/v1/object/test/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function assertStoredMedia(
  key: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const stored = storedImages.get(storageObjectPath(key));
  assert.ok(stored, `Storage object is missing at ${key}`);
  assert.equal(stored.contentType, contentType);
  assert.deepEqual(stored.bytes, Buffer.from(bytes));
}

async function mediaStorageRecord(id: string) {
  const result = await pool.query(
    "SELECT id, created_by, storage_key, mime_type, kind FROM media_assets WHERE id=$1",
    [id],
  );
  assert.equal(result.rowCount, 1, `Media asset ${id} is missing`);
  return result.rows[0] as {
    id: string;
    created_by: string | null;
    storage_key: string | null;
    mime_type: string | null;
    kind: string;
  };
}

async function actorIdForCookie(cookie: string) {
  const token = cookie.slice("em_session=".length);
  const result = await pool.query(
    "SELECT user_id FROM sessions WHERE token_hash=$1",
    [hashSessionToken(token)],
  );
  assert.equal(result.rowCount, 1);
  return result.rows[0].user_id as string;
}

test("catalog media retains validation, streaming, permissions, and OpenAPI contracts", async () => {
  assert.deepEqual(await read(await call("/catalog-media/not-a-uuid"), 404), {
    error: "Media not found.",
  });
  assert.deepEqual(
    await read(
      await call(
        "/admin/catalog-media/not-a-uuid",
        "DELETE",
        undefined,
        adminCookie,
      ),
      404,
    ),
    { error: "Media not found." },
  );
  await read(await call("/admin/catalog-media/not-a-uuid", "DELETE"), 401);
  assert.deepEqual(
    await read(
      await call("/admin/catalog-media", "POST", {}, adminCookie),
      400,
    ),
    { error: "Invalid multipart form." },
  );

  const missing = new FormData();
  const duplicate = new FormData();
  duplicate.append(
    "file",
    new Blob(["first"], { type: "image/png" }),
    "first.png",
  );
  duplicate.append(
    "file",
    new Blob(["second"], { type: "image/png" }),
    "second.png",
  );
  for (const form of [missing, duplicate]) {
    const response = await app.request("/v1/admin/catalog-media", {
      method: "POST",
      headers: { Cookie: adminCookie },
      body: form,
    });
    assert.deepEqual(await read(response, 400), {
      error: "Choose one media file.",
    });
  }

  const bytes = new Uint8Array([
    0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
    111, 109,
  ]);
  const media = await read(await uploadCanvas(bytes, "video/mp4"), 201);
  await read(await app.request(media.url), 404);
  await read(
    await app.request(media.url, { headers: { Cookie: customerCookie } }),
    404,
  );
  const preview = await app.request(media.url, {
    headers: { Cookie: adminCookie },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(new Uint8Array(await preview.arrayBuffer()), bytes);

  const saved = await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        name: "Media route regression",
        sections: [
          {
            id: randomUUID(),
            title: "Film",
            widgets: [
              {
                id: randomUUID(),
                type: "video",
                x: 0,
                y: 0,
                w: 12,
                h: 6,
                markdown: "",
                media,
                alt: "",
                caption: "",
              },
            ],
          },
        ],
      },
      adminCookie,
    ),
    201,
  );
  const stream = await app.request(media.url);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get("cache-control"), "public, max-age=300");
  assert.equal(stream.headers.get("content-type"), "video/mp4");
  assert.equal(stream.headers.get("accept-ranges"), "bytes");
  assert.deepEqual(new Uint8Array(await stream.arrayBuffer()), bytes);
  const partial = await app.request(media.url, {
    headers: { Range: "bytes=4-7" },
  });
  assert.equal(partial.status, 206);
  assert.equal(
    partial.headers.get("content-range"),
    `bytes 4-7/${bytes.length}`,
  );
  assert.equal(await partial.text(), "ftyp");
  assert.equal(
    (await app.request(media.url, { headers: { Range: "bytes=100-200" } }))
      .status,
    416,
  );
  await read(
    await call(
      `/admin/catalog-media/${media.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/packages/${saved.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  await read(await app.request(media.url), 404);
  await read(
    await call(`/admin/packages/${saved.id}`, "DELETE", undefined, adminCookie),
    204,
  );
  const pending = await read(await uploadCanvas(bytes, "video/mp4"), 201);
  await read(
    await call(
      `/admin/catalog-media/${pending.id}`,
      "DELETE",
      undefined,
      customerCookie,
    ),
    403,
  );
  await read(
    await call(
      `/admin/catalog-media/${pending.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  await read(
    await app.request(pending.url, { headers: { Cookie: adminCookie } }),
    404,
  );

  const spec = await (await app.request("/openapi.json")).json();
  assert.deepEqual(
    spec.paths["/v1/admin/catalog-media"].post.requestBody.content[
      "multipart/form-data"
    ].schema,
    {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  );
  assert.ok(spec.paths["/v1/admin/catalog-media/{id}"].delete);
  assert.ok(spec.paths["/v1/catalog-media/{id}"].get.responses[206]);
  assert.ok(spec.paths["/v1/catalog-media/{id}"].get.responses[416]);
});
test("video autoplay is opt-in, persists on public reads, and cannot be enabled for other widgets", async () => {
  const ordinary = await read(
    await call("/admin/packages", "POST", data, adminCookie),
    201,
  );
  assert.ok(
    ordinary.sections[0].widgets.every(
      (widget: { autoplay: boolean }) => widget.autoplay === false,
    ),
  );
  for (const index of [0, 1]) {
    const invalid = structuredClone(data);
    Object.assign(invalid.sections[0].widgets[index], { autoplay: true });
    await read(
      await call("/admin/packages", "POST", invalid, adminCookie),
      400,
    );
  }
  const invalidEdit = structuredClone(data);
  Object.assign(invalidEdit.sections[0].widgets[0], { autoplay: true });
  await read(
    await call(
      `/admin/packages/${ordinary.id}`,
      "PATCH",
      { ...invalidEdit, expectedUpdatedAt: ordinary.updatedAt },
      adminCookie,
    ),
    400,
  );
  assert.equal(
    (await read(await call(`/packages/${ordinary.id}`), 200)).sections[0]
      .widgets[0].autoplay,
    false,
  );
  const mp4 = new Uint8Array([
    0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
    111, 109,
  ]);
  const media = await read(await uploadCanvas(mp4, "video/mp4"), 201);
  const video = {
    id: randomUUID(),
    type: "video",
    x: 0,
    y: 0,
    w: 12,
    h: 6,
    markdown: "",
    media,
    alt: "",
    caption: "Event film",
    autoplay: true,
  };
  const content = {
    ...data,
    name: "Autoplay film",
    sections: [{ id: randomUUID(), title: "Film", widgets: [video] }],
  };
  const created = await read(
    await call("/admin/packages", "POST", content, adminCookie),
    201,
  );
  const published = await read(await call(`/packages/${created.id}`), 200);
  assert.equal(published.sections[0].widgets[0].autoplay, true);
  assert.equal(published.sections[0].widgets[0].caption, "Event film");
  assert.equal(
    (
      await pool.query(
        "SELECT canvas->0->'widgets'->0->>'autoplay' AS autoplay FROM packages WHERE id=$1",
        [created.id],
      )
    ).rows[0].autoplay,
    "true",
  );
  const invalid = {
    ...content,
    sections: [
      { ...content.sections[0], widgets: [{ ...video, autoplay: "true" }] },
    ],
  };
  await read(await call("/admin/packages", "POST", invalid, adminCookie), 400);
  const edited = await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      {
        ...content,
        sections: [
          { ...content.sections[0], widgets: [{ ...video, autoplay: false }] },
        ],
        expectedUpdatedAt: created.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(edited.sections[0].widgets[0].autoplay, false);
  assert.equal(
    (await read(await call(`/packages/${created.id}`), 200)).sections[0]
      .widgets[0].autoplay,
    false,
  );
  await read(
    await call(
      `/admin/packages/${ordinary.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  await read(
    await call(
      `/admin/packages/${created.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
});
test("pending media stays private, published video streams ranges, and cleanup preserves saved assets", async () => {
  const mp4 = new Uint8Array([
    0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
    111, 109,
  ]);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  await read(await uploadCanvas(mp4, "video/mp4", customerCookie), 403);
  await read(await uploadCanvas(mp4, "image/png"), 400);
  const media = await read(await uploadCanvas(mp4, "video/mp4"), 201);
  const thumbnail = await read(await uploadCanvas(png, "image/png"), 201);
  const adminId = await actorIdForCookie(adminCookie);
  const pendingVideoKey = `pending/${adminId}/${media.id}.mp4`;
  const pendingThumbnailKey = `pending/${adminId}/${thumbnail.id}.png`;
  assert.equal(
    (await mediaStorageRecord(media.id)).storage_key,
    pendingVideoKey,
  );
  assert.equal((await mediaStorageRecord(media.id)).created_by, adminId);
  assert.equal(
    (await mediaStorageRecord(thumbnail.id)).storage_key,
    pendingThumbnailKey,
  );
  assertStoredMedia(pendingVideoKey, mp4, "video/mp4");
  assertStoredMedia(pendingThumbnailKey, png, "image/png");
  await read(await app.request(media.url), 404);
  const c = {
    ...data,
    thumbnailMediaId: thumbnail.id,
    sections: [
      {
        id: randomUUID(),
        title: "Film",
        widgets: [
          {
            id: randomUUID(),
            type: "video",
            x: 0,
            y: 0,
            w: 12,
            h: 6,
            markdown: "",
            media,
            alt: "",
            caption: "Event film",
          },
        ],
      },
    ],
  };
  const saved = await read(
    await call("/admin/packages", "POST", c, adminCookie),
    201,
  );
  const packageVideoKey = `packages/${saved.id}/videos/${media.id}.mp4`;
  const packageThumbnailKey = `packages/${saved.id}/images/${thumbnail.id}.png`;
  assert.equal(
    (await mediaStorageRecord(media.id)).storage_key,
    packageVideoKey,
  );
  assert.equal(
    (await mediaStorageRecord(thumbnail.id)).storage_key,
    packageThumbnailKey,
  );
  assertStoredMedia(packageVideoKey, mp4, "video/mp4");
  assertStoredMedia(packageThumbnailKey, png, "image/png");
  assert.equal(storedImages.has(storageObjectPath(pendingVideoKey)), false);
  assert.equal(storedImages.has(storageObjectPath(pendingThumbnailKey)), false);
  const stream = await app.request(media.url);
  assert.equal(stream.status, 200);
  assert.equal(stream.headers.get("accept-ranges"), "bytes");
  assert.deepEqual(new Uint8Array(await stream.arrayBuffer()), mp4);
  const part = await app.request(media.url, {
    headers: { Range: "bytes=4-7" },
  });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get("content-range"), `bytes 4-7/${mp4.length}`);
  assert.equal(Buffer.from(await part.arrayBuffer()).toString(), "ftyp");
  assert.equal(
    (await app.request(media.url, { headers: { Range: "bytes=100-200" } }))
      .status,
    416,
  );
  await read(
    await call(
      `/admin/catalog-media/${media.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/packages/${saved.id}`,
      "PATCH",
      { ...data, expectedUpdatedAt: saved.updatedAt },
      adminCookie,
    ),
    200,
  );
  await read(await app.request(media.url), 404);
  assert.equal(
    (
      await pool.query("SELECT count(*) FROM media_assets WHERE id=$1", [
        media.id,
      ])
    ).rows[0].count,
    "0",
  );
  const pending = await read(await uploadCanvas(mp4, "video/mp4"), 201);
  await read(
    await call(
      `/admin/catalog-media/${pending.id}`,
      "DELETE",
      undefined,
      customerCookie,
    ),
    403,
  );
  await read(
    await call(
      `/admin/catalog-media/${pending.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/packages/{id}"].patch);
  assert.equal(spec.paths["/v1/admin/packages/{id}/publish"], undefined);
  await read(
    await call(`/admin/packages/${saved.id}`, "DELETE", undefined, adminCookie),
    204,
  );
});

test("stale pending uploads can be swept while referenced media survives", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const old = await read(await uploadCanvas(png, "image/png"), 201);
  await pool.query(
    "UPDATE media_assets SET created_at=now()-interval '2 days' WHERE id=$1",
    [old.id],
  );
  const { cleanupStaleCatalogMediaService } =
    await import("../src/services/catalog-media/cleanup-stale-catalog-media.js");
  await cleanupStaleCatalogMediaService(db);
  assert.equal(
    (
      await pool.query("SELECT count(*) FROM media_assets WHERE id=$1", [
        old.id,
      ])
    ).rows[0].count,
    "0",
  );
  const media = await read(await uploadCanvas(png, "image/png"), 201);
  const c = structuredClone(data);
  c.sections[0].widgets[0].media = media;
  const saved = await read(
    await call("/admin/packages", "POST", c, adminCookie),
    201,
  );
  await pool.query(
    "UPDATE media_assets SET created_at=now()-interval '2 days' WHERE id=$1",
    [media.id],
  );
  await cleanupStaleCatalogMediaService(db);
  assert.equal((await app.request(media.url)).status, 200);
  await read(
    await call(`/admin/packages/${saved.id}`, "DELETE", undefined, adminCookie),
    204,
  );
});

test("catalog media promotion retries failed copies and reads through relocation", async () => {
  const { promoteOwnerCatalogMediaService } =
    await import("../src/services/catalog-media/promote-catalog-media.js");
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const media = await read(await uploadCanvas(png, "image/png"), 201);
  const pendingKey = `pending/${await actorIdForCookie(adminCookie)}/${media.id}.png`;
  const sections = structuredClone(data.sections);
  sections[0].widgets[0] = { ...sections[0].widgets[0], media };
  sections[0].widgets[1] = { ...sections[0].widgets[1] };
  const content = {
    ...data,
    name: `Promotion retry ${randomUUID()}`,
    sections,
  };

  let saved: any;
  failStorageWrites = true;
  try {
    saved = await read(
      await call("/admin/packages", "POST", content, adminCookie),
      201,
    );
  } finally {
    failStorageWrites = false;
  }
  const destinationKey = `packages/${saved.id}/images/${media.id}.png`;
  assert.equal((await mediaStorageRecord(media.id)).storage_key, pendingKey);
  assertStoredMedia(pendingKey, png, "image/png");
  assert.equal(storedImages.has(storageObjectPath(destinationKey)), false);

  let promotionResult: unknown;
  beforeStorageGet = {
    path: storageObjectPath(pendingKey),
    callback: async () => {
      promotionResult = await promoteOwnerCatalogMediaService(db, {
        kind: "package",
        id: saved.id,
      });
    },
  };
  const readDuringMove = await app.request(media.url);
  assert.equal(beforeStorageGet, undefined);
  assert.ok(promotionResult !== undefined);
  assert.equal(readDuringMove.status, 200);
  assert.deepEqual(new Uint8Array(await readDuringMove.arrayBuffer()), png);
  assert.equal(
    (await mediaStorageRecord(media.id)).storage_key,
    destinationKey,
  );
  assertStoredMedia(destinationKey, png, "image/png");
  assert.equal(storedImages.has(storageObjectPath(pendingKey)), false);

  const noSuchKeyMedia = await read(await uploadCanvas(png, "image/png"), 201);
  const noSuchKeyPendingKey = `pending/${await actorIdForCookie(adminCookie)}/${noSuchKeyMedia.id}.png`;
  const noSuchKeySections = structuredClone(data.sections);
  noSuchKeySections[0].widgets[0] = {
    ...noSuchKeySections[0].widgets[0],
    media: noSuchKeyMedia,
  };
  const noSuchKeyContent = {
    ...data,
    name: `NoSuchKey promotion retry ${randomUUID()}`,
    sections: noSuchKeySections,
  };
  let noSuchKeyPackage: any;
  failStorageWrites = true;
  try {
    noSuchKeyPackage = await read(
      await call("/admin/packages", "POST", noSuchKeyContent, adminCookie),
      201,
    );
  } finally {
    failStorageWrites = false;
  }
  const noSuchKeyDestinationKey = `packages/${noSuchKeyPackage.id}/images/${noSuchKeyMedia.id}.png`;
  assert.equal(
    (await mediaStorageRecord(noSuchKeyMedia.id)).storage_key,
    noSuchKeyPendingKey,
  );
  assertStoredMedia(noSuchKeyPendingKey, png, "image/png");
  beforeStorageGet = {
    path: storageObjectPath(noSuchKeyPendingKey),
    callback: () =>
      promoteOwnerCatalogMediaService(db, {
        kind: "package",
        id: noSuchKeyPackage.id,
      }).then(() => undefined),
  };
  let noSuchKeyRead: Response;
  missingStorageGetAs400 = true;
  try {
    noSuchKeyRead = await app.request(noSuchKeyMedia.url);
  } finally {
    missingStorageGetAs400 = false;
  }
  assert.equal(beforeStorageGet, undefined);
  assert.equal(noSuchKeyRead!.status, 200);
  assert.deepEqual(new Uint8Array(await noSuchKeyRead!.arrayBuffer()), png);
  assert.equal(
    (await mediaStorageRecord(noSuchKeyMedia.id)).storage_key,
    noSuchKeyDestinationKey,
  );
  assert.equal(storedImages.has(storageObjectPath(noSuchKeyPendingKey)), false);
  assertStoredMedia(noSuchKeyDestinationKey, png, "image/png");

  const retainedMedia = await read(await uploadCanvas(png, "image/png"), 201);
  const retainedPendingKey = `pending/${await actorIdForCookie(adminCookie)}/${retainedMedia.id}.png`;
  const retainedSections = structuredClone(data.sections);
  retainedSections[0].widgets[0] = {
    ...retainedSections[0].widgets[0],
    media: retainedMedia,
  };
  const retainedContent = {
    ...data,
    name: `Promotion delete retry ${randomUUID()}`,
    sections: retainedSections,
  };
  let retainedPackage: any;
  failStorageDeletes = true;
  try {
    retainedPackage = await read(
      await call("/admin/packages", "POST", retainedContent, adminCookie),
      201,
    );
  } finally {
    failStorageDeletes = false;
  }
  const retainedDestinationKey = `packages/${retainedPackage.id}/images/${retainedMedia.id}.png`;
  assert.equal(
    (await mediaStorageRecord(retainedMedia.id)).storage_key,
    retainedDestinationKey,
  );
  assertStoredMedia(retainedPendingKey, png, "image/png");
  assertStoredMedia(retainedDestinationKey, png, "image/png");
  const retainedRead = await app.request(retainedMedia.url);
  assert.equal(retainedRead.status, 200);
  assert.deepEqual(new Uint8Array(await retainedRead.arrayBuffer()), png);

  await read(
    await call(
      `/admin/packages/${retainedPackage.id}`,
      "PATCH",
      { ...retainedContent, expectedUpdatedAt: retainedPackage.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(storedImages.has(storageObjectPath(retainedPendingKey)), false);
  assertStoredMedia(retainedDestinationKey, png, "image/png");
});

test("stale package saves leave new media pending and untouched", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const packageContent = {
    ...data,
    name: `Stale media save ${randomUUID()}`,
  };
  const created = await read(
    await call("/admin/packages", "POST", packageContent, adminCookie),
    201,
  );
  const advanced = await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      {
        ...packageContent,
        name: `${packageContent.name} updated`,
        expectedUpdatedAt: created.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  const media = await read(await uploadCanvas(png, "image/png"), 201);
  const pendingKey = `pending/${await actorIdForCookie(adminCookie)}/${media.id}.png`;
  const sections = structuredClone(data.sections);
  sections[0].widgets[0].media = media;
  await read(
    await call(
      `/admin/packages/${created.id}`,
      "PATCH",
      {
        ...packageContent,
        sections,
        expectedUpdatedAt: created.updatedAt,
      },
      adminCookie,
    ),
    409,
  );
  assert.equal((await mediaStorageRecord(media.id)).storage_key, pendingKey);
  assertStoredMedia(pendingKey, png, "image/png");
  assert.equal(advanced.name, `${packageContent.name} updated`);
  await read(
    await call(
      `/admin/catalog-media/${media.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  assert.equal(storedImages.has(storageObjectPath(pendingKey)), false);
});

test("admin archived media is private and unclaimed uploads cannot be taken by another admin", async () => {
  const token = randomUUID();
  const user = await db
    .insertInto("users")
    .values({
      email: `admin-${randomUUID()}@example.test`,
      password_hash: "unused",
      role: "admin",
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
  const other = `em_session=${token}`;
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const media = await read(await uploadCanvas(png, "image/png"), 201);
  assert.equal((await app.request(media.url)).status, 404);
  assert.equal(
    (await app.request(media.url, { headers: { Cookie: adminCookie } })).status,
    200,
  );
  const c = structuredClone(data);
  c.sections[0].widgets[0].media = media;
  await read(await call("/admin/packages", "POST", c, other), 400);
  const uppercase = structuredClone(c);
  assert.ok(uppercase.sections[0].widgets[0].media);
  Object.assign(uppercase.sections[0].widgets[0].media, {
    id: media.id.toUpperCase(),
  });
  await read(await call("/admin/packages", "POST", uppercase, other), 400);
  const pkg = await read(
    await call("/admin/packages", "POST", uppercase, adminCookie),
    201,
  );
  assert.equal(pkg.sections[0].widgets[0].media.id, media.id);
  assert.equal(
    (
      await pool.query(
        "SELECT canvas->0->'widgets'->0->>'mediaId' AS id FROM packages WHERE id=$1",
        [pkg.id],
      )
    ).rows[0].id,
    media.id,
  );
  const edit = await read(
    await call(
      `/admin/packages/${pkg.id}`,
      "PATCH",
      {
        ...c,
        name: "Other administrator edit",
        expectedUpdatedAt: pkg.updatedAt,
      },
      other,
    ),
    200,
  );
  await read(
    await call(`/admin/packages/${pkg.id}/archive`, "POST", undefined, other),
    200,
  );
  assert.equal((await app.request(media.url)).status, 404);
  assert.equal(
    (await app.request(media.url, { headers: { Cookie: customerCookie } }))
      .status,
    404,
  );
  const archivedMedia = await app.request(media.url, {
    headers: { Cookie: other },
  });
  assert.equal(archivedMedia.status, 200);
  assert.equal(archivedMedia.headers.get("cache-control"), "private, no-store");
  await read(
    await call(`/admin/packages/${edit.id}`, "DELETE", undefined, other),
    204,
  );
});

test("canvas collection, Markdown and transport boundaries are enforced", async () => {
  const {
    MAX_CATALOG_WIDGETS,
    MAX_CATALOG_SECTIONS,
    MAX_WIDGET_MARKDOWN_LENGTH,
  } = await import("@event-management/contracts/catalog");
  const { CATALOG_JSON_BODY_LIMIT_BYTES } =
    await import("../src/constants/http.js");
  const { MAX_VIDEO_SIZE_BYTES } =
    await import("@event-management/contracts/limits/videos");
  const makeWidget = (i: number, length = 1) => ({
    id: randomUUID(),
    type: "markdown",
    x: 0,
    y: i,
    w: 12,
    h: 1,
    markdown: "a".repeat(length),
    media: null,
    alt: "",
    caption: "",
  });
  const maximum = {
    ...data,
    sections: [
      {
        id: randomUUID(),
        title: "",
        widgets: Array.from({ length: MAX_CATALOG_WIDGETS }, (_, i) =>
          makeWidget(i, MAX_WIDGET_MARKDOWN_LENGTH),
        ),
      },
    ],
  };
  const saved = await read(
    await call("/admin/packages", "POST", maximum, adminCookie),
    201,
  );
  assert.equal(saved.sections[0].widgets.length, MAX_CATALOG_WIDGETS);
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...maximum,
        sections: [
          {
            ...maximum.sections[0],
            widgets: [...maximum.sections[0].widgets, makeWidget(101)],
          },
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
        sections: Array.from({ length: MAX_CATALOG_SECTIONS + 1 }, () => ({
          id: randomUUID(),
          title: "",
          widgets: [],
        })),
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
        sections: [
          {
            id: randomUUID(),
            title: "",
            widgets: [makeWidget(0, MAX_WIDGET_MARKDOWN_LENGTH + 1)],
          },
        ],
      },
      adminCookie,
    ),
    400,
  );
  const oversized = await app.request("/v1/admin/packages", {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      padding: "a".repeat(CATALOG_JSON_BODY_LIMIT_BYTES),
    }),
  });
  assert.equal(oversized.status, 413);
  await read(
    await uploadCanvas(new Uint8Array(MAX_VIDEO_SIZE_BYTES + 1), "video/mp4"),
    413,
  );
});

test("service canvases save rich content directly and enforce media ownership", async () => {
  const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const mp4 = new Uint8Array([
    0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
    111, 109,
  ]);
  const photo = await read(await uploadCanvas(image, "image/png"), 201);
  const video = await read(await uploadCanvas(mp4, "video/mp4"), 201);
  const sections = [
    {
      id: randomUUID(),
      title: "Gallery",
      widgets: [
        {
          id: randomUUID(),
          type: "photo",
          x: 0,
          y: 0,
          w: 6,
          h: 6,
          markdown: "",
          media: photo,
          alt: "Photo",
          caption: "",
          autoplay: false,
        },
        {
          id: randomUUID(),
          type: "video",
          x: 6,
          y: 3,
          w: 5,
          h: 8,
          markdown: "",
          media: video,
          alt: "Film",
          caption: "Film caption",
          autoplay: true,
        },
        {
          id: randomUUID(),
          type: "markdown",
          x: 2,
          y: 12,
          w: 8,
          h: 4,
          markdown: "## Details\n\n**Custom content**",
          media: null,
          alt: "",
          caption: "",
          autoplay: false,
        },
      ],
    },
    {
      id: randomUUID(),
      title: "More details",
      widgets: [
        {
          id: randomUUID(),
          type: "markdown",
          x: 1,
          y: 2,
          w: 5,
          h: 3,
          markdown: "Additional details",
          media: null,
          alt: "",
          caption: "",
          autoplay: false,
        },
      ],
    },
  ];
  const service = {
    name: "Canvas service",
    description: "Summary",
    hourlyRatePesos: 100,
    fixedPricePesos: null,
    includedHours: null,
    sections,
  };
  const created = await read(
    await call("/admin/services", "POST", service, adminCookie),
    201,
  );
  const adminId = await actorIdForCookie(adminCookie);
  const servicePhotoKey = `services/${created.id}/images/${photo.id}.png`;
  const serviceVideoKey = `services/${created.id}/videos/${video.id}.mp4`;
  assert.equal(
    (await mediaStorageRecord(photo.id)).storage_key,
    servicePhotoKey,
  );
  assert.equal(
    (await mediaStorageRecord(video.id)).storage_key,
    serviceVideoKey,
  );
  assertStoredMedia(servicePhotoKey, image, "image/png");
  assertStoredMedia(serviceVideoKey, mp4, "video/mp4");
  assert.equal(
    storedImages.has(storageObjectPath(`pending/${adminId}/${photo.id}.png`)),
    false,
  );
  assert.equal(
    storedImages.has(storageObjectPath(`pending/${adminId}/${video.id}.mp4`)),
    false,
  );
  const savedCanvas = (
    await pool.query("SELECT canvas FROM services WHERE id=$1", [created.id])
  ).rows[0].canvas;
  assert.deepEqual(
    savedCanvas,
    sections.map((section) => ({
      id: section.id,
      title: section.title,
      widgets: section.widgets.map(({ media, ...widget }) => ({
        ...widget,
        mediaId: media?.id ?? null,
      })),
    })),
  );
  const visible = await read(await call(`/services/${created.id}`), 200);
  assert.equal(visible.imageUrl, null);
  assert.deepEqual(
    visible.sections[0].widgets.map((w: any) => [w.type, w.x, w.y, w.w, w.h]),
    [
      ["photo", 0, 0, 6, 6],
      ["video", 6, 3, 5, 8],
      ["markdown", 2, 12, 8, 4],
    ],
  );
  assert.equal(visible.sections[0].widgets[1].autoplay, true);
  assert.equal(
    visible.sections[0].widgets[2].markdown,
    "## Details\n\n**Custom content**",
  );
  assert.equal((await call(`/catalog-media/${photo.id}`)).status, 200);
  const { sections: ignored, ...legacy } = service;
  const edited = await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      { ...legacy, name: "Changed", expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.deepEqual(
    (await pool.query("SELECT canvas FROM services WHERE id=$1", [created.id]))
      .rows[0].canvas,
    savedCanvas,
  );
  await read(
    await call(
      `/admin/services/${created.id}`,
      "PATCH",
      {
        ...legacy,
        name: "Stale edit",
        expectedUpdatedAt: created.updatedAt,
      },
      adminCookie,
    ),
    409,
  );
  assert.deepEqual(
    (await pool.query("SELECT canvas FROM services WHERE id=$1", [created.id]))
      .rows[0].canvas,
    savedCanvas,
  );
  assert.equal(edited.sections[0].widgets[0].media.id, photo.id);
  assert.deepEqual(
    edited.sections[0].widgets.map((w: any) => [w.x, w.y, w.w, w.h]),
    [
      [0, 0, 6, 6],
      [6, 3, 5, 8],
      [2, 12, 8, 4],
    ],
  );
  assert.equal(
    (await read(await call(`/services/${created.id}`), 200)).name,
    "Changed",
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
  assert.equal((await call(`/catalog-media/${photo.id}`)).status, 404);
  assert.equal(
    (await call(`/catalog-media/${photo.id}`, "GET", undefined, adminCookie))
      .status,
    200,
  );
  await read(
    await call(
      `/admin/services/${created.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  assert.equal(
    (await pool.query("SELECT id FROM media_assets WHERE id=$1", [photo.id]))
      .rowCount,
    0,
  );
  assert.equal(
    (await pool.query("SELECT id FROM media_assets WHERE id=$1", [video.id]))
      .rowCount,
    0,
  );
});

test("booking-owned packages retain the inquiry and isolate copied media", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const media = await read(await uploadCanvas(png, "image/png"), 201);
  const thumbnail = await read(await uploadCanvas(png, "image/png"), 201);
  const includedService = await createServiceWithPhoto({
    name: `Included ${randomUUID()}`,
    description: "Coverage",
    hourlyRatePesos: 500,
  });
  const content = {
    ...data,
    name: `Original ${randomUUID()}`,
    thumbnailMediaId: thumbnail.id,
    sections: [
      {
        id: randomUUID(),
        title: "",
        widgets: [
          {
            id: randomUUID(),
            type: "photo",
            x: 0,
            y: 0,
            w: 12,
            h: 6,
            markdown: "",
            media,
            alt: "",
            caption: "",
          },
          {
            id: randomUUID(),
            type: "service",
            x: 0,
            y: 6,
            w: 6,
            h: 3,
            markdown: "",
            media: null,
            alt: "",
            caption: "Included service",
            autoplay: false,
            serviceId: includedService.id,
          },
        ],
      },
    ],
  };
  const original = await read(
    await call("/admin/packages", "POST", content, adminCookie),
    201,
  );
  const adminId = await actorIdForCookie(adminCookie);
  const sourceMediaKey = `packages/${original.id}/images/${media.id}.png`;
  const sourceThumbnailKey = `packages/${original.id}/images/${thumbnail.id}.png`;
  assert.equal(
    (await mediaStorageRecord(media.id)).storage_key,
    sourceMediaKey,
  );
  assertStoredMedia(sourceMediaKey, png, "image/png");
  assert.equal(
    (await mediaStorageRecord(thumbnail.id)).storage_key,
    sourceThumbnailKey,
  );
  assertStoredMedia(sourceThumbnailKey, png, "image/png");
  assert.equal(
    storedImages.has(storageObjectPath(`pending/${adminId}/${media.id}.png`)),
    false,
  );
  assert.equal(
    storedImages.has(
      storageObjectPath(`pending/${adminId}/${thumbnail.id}.png`),
    ),
    false,
  );
  const bookingInput = {
    packageId: original.id,
    packageUpdatedAt: original.updatedAt,
    eventType: "Wedding",
    durationMode: "one_day",
    requestedDays: [{ date: "2099-01-02" }],
    timeZone: "Asia/Manila",
    guestCount: 50,
    contactName: "Customer",
    phoneNumber: "123",
  };
  const booking = (
    await read(
      await call("/booking-requests", "POST", bookingInput, customerCookie),
      201,
    )
  ).bookingRequest;
  const before = await read(
    await call(
      `/admin/booking-requests/${booking.id}/package`,
      "GET",
      undefined,
      adminCookie,
    ),
    200,
  );
  const save = {
    ...content,
    expectedUpdatedAt: before.package.updatedAt,
    expectedBookingUpdatedAt: before.bookingUpdatedAt,
  };
  await read(
    await call(
      `/admin/booking-requests/${booking.id}/custom-package`,
      "POST",
      { ...save, services: [] },
      adminCookie,
    ),
    400,
  );
  const saved = await read(
    await call(
      `/admin/booking-requests/${booking.id}/custom-package`,
      "POST",
      save,
      adminCookie,
    ),
    200,
  );
  const custom = saved.package;
  const copiedMediaId = custom.sections[0].widgets[0].media.id;
  const copiedMediaKey = `bookings/${booking.id}/custom-package/images/${copiedMediaId}.png`;
  const copiedThumbnailId = custom.imageUrl.split("/").at(-1)!;
  const copiedThumbnailKey = `bookings/${booking.id}/custom-package/images/${copiedThumbnailId}.png`;
  assert.notEqual(custom.id, original.id);
  assert.notEqual(copiedMediaId, media.id);
  assert.notEqual(copiedThumbnailId, thumbnail.id);
  assert.equal(
    (await mediaStorageRecord(copiedMediaId)).storage_key,
    copiedMediaKey,
  );
  assert.equal((await mediaStorageRecord(copiedMediaId)).created_by, adminId);
  assertStoredMedia(copiedMediaKey, png, "image/png");
  assertStoredMedia(sourceMediaKey, png, "image/png");
  assert.equal(
    (await mediaStorageRecord(copiedThumbnailId)).storage_key,
    copiedThumbnailKey,
  );
  assert.equal(
    (await mediaStorageRecord(copiedThumbnailId)).created_by,
    adminId,
  );
  assertStoredMedia(copiedThumbnailKey, png, "image/png");
  assertStoredMedia(sourceThumbnailKey, png, "image/png");
  assert.equal(custom.name, original.name);
  assert.equal(custom.packageType, "custom");
  const privateWidget = {
    id: randomUUID(),
    type: "package",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    markdown: "",
    media: null,
    alt: "",
    caption: "",
    autoplay: false,
    packageId: custom.id,
  };
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...data,
        name: `Private link ${randomUUID()}`,
        sections: [{ id: randomUUID(), title: "", widgets: [privateWidget] }],
      },
      adminCookie,
    ),
    400,
  );

  assert.equal("services" in custom, false);
  assert.equal("services" in original, false);
  assert.equal(custom.sections[0].widgets[1].service.id, includedService.id);
  assert.equal(custom.sections[0].widgets[1].caption, "Included service");
  assert.equal(custom.customForBookingRequestId, booking.id);
  assert.equal(saved.bookingRequest.packageId, original.id);
  assert.equal(saved.bookingRequest.packageName, original.name);
  assert.equal(
    saved.bookingRequest.packagePrice.amountMinor,
    original.price.amountMinor,
  );
  assert.notEqual(custom.imageUrl, media.url);
  assert.equal((await app.request(custom.imageUrl)).status, 404);
  const otherToken = randomUUID();
  const other = await db
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      password_hash: "unused",
      role: "customer",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("sessions")
    .values({
      user_id: other.id,
      token_hash: hashSessionToken(otherToken),
      expires_at: new Date(Date.now() + 3600000),
    })
    .execute();
  const otherCookie = `em_session=${otherToken}`;
  await read(
    await call(
      `/booking-requests/${booking.id}/package`,
      "GET",
      undefined,
      otherCookie,
    ),
    404,
  );
  assert.equal(
    (await app.request(custom.imageUrl, { headers: { Cookie: otherCookie } }))
      .status,
    404,
  );
  const privateMedia = await app.request(custom.imageUrl, {
    headers: { Cookie: customerCookie, Range: "bytes=0-3" },
  });
  assert.equal(privateMedia.status, 206);
  assert.equal(privateMedia.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(
    new Uint8Array(await privateMedia.arrayBuffer()),
    png.slice(0, 4),
  );
  await read(await call(`/packages/${custom.id}`), 404);
  await read(
    await call(`/admin/packages/${custom.id}`, "GET", undefined, adminCookie),
    404,
  );
  await read(
    await call(
      "/booking-requests",
      "POST",
      { ...bookingInput, packageId: custom.id },
      customerCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/booking-requests/${booking.id}/custom-package`,
      "POST",
      save,
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/booking-requests/${booking.id}/custom-package`,
      "PATCH",
      {
        ...content,
        name: "Changed",
        sections: custom.sections,
        thumbnailMediaId: copiedThumbnailId,
        expectedUpdatedAt: custom.updatedAt,
        expectedBookingUpdatedAt: before.bookingUpdatedAt,
      },
      adminCookie,
    ),
    409,
  );
  const edit = await read(
    await call(
      `/admin/booking-requests/${booking.id}/custom-package`,
      "PATCH",
      {
        ...content,
        name: "Changed",
        sections: custom.sections,
        thumbnailMediaId: copiedThumbnailId,
        expectedUpdatedAt: custom.updatedAt,
        expectedBookingUpdatedAt: saved.bookingRequest.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(edit.package.name, "Changed");
  const historyResponse = await call(
    `/admin/booking-requests/${booking.id}/package-history`,
    "GET",
    undefined,
    adminCookie,
  );
  assert.equal(
    historyResponse.headers.get("cache-control"),
    "private, no-store",
  );
  const history = (await read(historyResponse, 200)).history;
  assert.equal(history.length, 2);
  assert.equal(history[0].before.name, original.name);
  assert.equal(history[0].after.name, "Changed");
  assert.equal(
    (await read(await call(`/packages/${original.id}`), 200)).name,
    original.name,
  );
  await read(
    await call(
      `/admin/packages/${original.id}`,
      "PATCH",
      {
        ...content,
        sections: [],
        thumbnailMediaId: null,
        expectedUpdatedAt: original.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal((await app.request(media.url)).status, 404);
  assert.equal(storedImages.has(storageObjectPath(sourceMediaKey)), false);
  assert.equal(storedImages.has(storageObjectPath(sourceThumbnailKey)), false);
  assertStoredMedia(copiedMediaKey, png, "image/png");
  assertStoredMedia(copiedThumbnailKey, png, "image/png");
  assert.deepEqual(
    new Uint8Array(
      await (
        await app.request(edit.package.imageUrl, {
          headers: { Cookie: customerCookie },
        })
      ).arrayBuffer(),
    ),
    png,
  );
  await read(
    await call(
      `/admin/services/${includedService.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  const privatePackage = await read(
    await call(
      `/booking-requests/${booking.id}/package`,
      "GET",
      undefined,
      customerCookie,
    ),
    200,
  );
  assert.equal(privatePackage.package.sections[0].widgets[1].service, null);
  assert.equal(
    privatePackage.package.sections[0].widgets[1].caption,
    "Included service",
  );
});

test("quotations do not retain removed package media or grant historical media access", async () => {
  const { cleanupStaleCatalogMediaService } =
    await import("../src/services/catalog-media/cleanup-stale-catalog-media.js");
  const media = await read(
    await uploadCanvas(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
      "image/png",
    ),
    201,
  );
  const content = {
    ...data,
    name: `Quotation media ${randomUUID()}`,
    sections: [
      {
        id: randomUUID(),
        title: "Current image",
        widgets: [
          {
            id: randomUUID(),
            type: "photo",
            x: 0,
            y: 0,
            w: 12,
            h: 6,
            markdown: "",
            media,
            alt: "Current photo",
            caption: "",
          },
        ],
      },
    ],
  };
  const pkg = await read(
    await call("/admin/packages", "POST", content, adminCookie),
    201,
  );
  const booking = (
    await read(
      await call(
        "/booking-requests",
        "POST",
        {
          packageId: pkg.id,
          packageUpdatedAt: pkg.updatedAt,
          eventType: "Wedding",
          durationMode: "one_day",
          requestedDays: [{ date: "2099-01-02" }],
          timeZone: "Asia/Manila",
          contactName: "Customer",
          phoneNumber: "123",
        },
        customerCookie,
      ),
      201,
    )
  ).bookingRequest;
  const draft = (
    await read(
      await call(
        `/admin/booking-requests/${booking.id}/quotations`,
        "POST",
        { expectedUpdatedAt: booking.updatedAt },
        adminCookie,
      ),
      201,
    )
  ).quotation;
  const sent = (
    await read(
      await call(
        `/admin/quotations/${draft.id}/send`,
        "POST",
        { expectedUpdatedAt: draft.updatedAt },
        adminCookie,
      ),
      200,
    )
  ).quotation;
  assert.equal(
    (await app.request(media.url, { headers: { Cookie: customerCookie } }))
      .status,
    200,
  );
  await read(
    await call(
      `/admin/packages/${pkg.id}`,
      "PATCH",
      { ...content, sections: [], expectedUpdatedAt: pkg.updatedAt },
      adminCookie,
    ),
    200,
  );
  await cleanupStaleCatalogMediaService(db);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM media_assets WHERE id=$1",
        [media.id],
      )
    ).rows[0].count,
    0,
  );
  for (const cookie of [customerCookie, adminCookie])
    assert.equal(
      (await app.request(media.url, { headers: { Cookie: cookie } })).status,
      404,
    );
  const history = (
    await read(
      await call(
        `/booking-requests/${booking.id}/quotations`,
        "GET",
        undefined,
        customerCookie,
      ),
      200,
    )
  ).quotations;
  assert.equal(history[0].id, sent.id);
  assert.equal(history[0].totalAmountMinor, sent.totalAmountMinor);
});

test("linked service widgets are validated, hydrated, and protect references", async () => {
  const serviceInput = {
    name: "Linked service",
    description: "Actual description",
    hourlyRatePesos: 500,
    fixedPricePesos: null,
    includedHours: null,
    sections: [data.sections[0]],
  };
  const service = await read(
    await call("/admin/services", "POST", serviceInput, adminCookie),
    201,
  );
  const widget = {
    id: randomUUID(),
    type: "service",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    markdown: "",
    media: null,
    alt: "",
    caption: "Our recommendation",
    autoplay: false,
    serviceId: service.id,
    service: {
      id: service.id,
      slug: "forged",
      name: "Forged",
      description: "Forged",
      imageUrl: null,
    },
  };
  const sections = [{ id: randomUUID(), title: "Services", widgets: [widget] }];
  const content = { ...data, name: "Linked package", sections };
  await read(
    await call("/admin/packages", "POST", content, customerCookie),
    403,
  );
  for (const bad of [
    { ...widget, serviceId: null },
    { ...widget, markdown: "bad" },
    { ...widget, autoplay: true },
    { ...widget, type: "markdown", markdown: "bad" },
    { ...widget, serviceId: randomUUID() },
  ]) {
    await read(
      await call(
        "/admin/packages",
        "POST",
        { ...content, sections: [{ ...sections[0], widgets: [bad] }] },
        adminCookie,
      ),
      400,
    );
  }
  const pkg = await read(
    await call("/admin/packages", "POST", content, adminCookie),
    201,
  );
  await read(
    await call(
      `/admin/services/${service.id.toUpperCase()}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  const stored = await pool.query("select canvas from packages where id = $1", [
    pkg.id,
  ]);
  assert.equal(stored.rows[0].canvas[0].widgets[0].serviceId, service.id);
  assert.equal("service" in stored.rows[0].canvas[0].widgets[0], false);
  const chunks = await pool.query(
    "select chunk_key, content_markdown, media_id from catalog_knowledge where package_id = $1",
    [pkg.id],
  );
  const serviceChunk = chunks.rows.find(
    (row) => row.chunk_key === `service:${widget.id}`,
  );
  assert.match(serviceChunk.content_markdown, /Our recommendation/);
  assert.doesNotMatch(serviceChunk.content_markdown, /Forged|Linked service/);
  assert.equal(serviceChunk.media_id, null);
  const publicPackage = await read(await call(`/packages/${pkg.id}`), 200);
  assert.equal(
    publicPackage.sections[0].widgets[0].service.name,
    "Linked service",
  );
  assert.equal(publicPackage.sections[0].widgets[0].service.imageUrl, null);
  await read(
    await call(
      `/admin/services/${service.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  const other = await read(
    await call(
      "/admin/services",
      "POST",
      {
        ...serviceInput,
        name: "Service owner",
        sections: [data.sections[0], sections[0]],
      },
      adminCookie,
    ),
    201,
  );
  await read(
    await call(`/admin/packages/${pkg.id}`, "DELETE", undefined, adminCookie),
    204,
  );
  await read(
    await call(
      `/admin/services/${service.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  await read(
    await call(`/admin/services/${other.id}`, "DELETE", undefined, adminCookie),
    204,
  );
  const replacement = await read(
    await call("/admin/packages", "POST", content, adminCookie),
    201,
  );
  const renamed = await read(
    await call(
      `/admin/services/${service.id}`,
      "PATCH",
      {
        ...serviceInput,
        name: "Renamed service",
        expectedUpdatedAt: service.updatedAt,
      },
      adminCookie,
    ),
    200,
  );
  assert.equal(
    (await read(await call(`/packages/${replacement.id}`), 200)).sections[0]
      .widgets[0].service.name,
    "Renamed service",
  );
  await read(
    await call(
      `/admin/services/${service.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  const unavailable = await read(
    await call(`/packages/${replacement.id}`),
    200,
  );
  assert.equal(unavailable.sections[0].widgets[0].service, null);
  const retained = await read(
    await call(
      `/admin/packages/${replacement.id}`,
      "PATCH",
      { ...content, expectedUpdatedAt: replacement.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(retained.sections[0].widgets[0].serviceId, service.id);
  assert.equal(retained.sections[0].widgets[0].service, null);
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...content, name: "New link" },
      adminCookie,
    ),
    400,
  );
  assert.ok(renamed.id);
});

test("linked package widgets hydrate public records and protect both owner types", async () => {
  const target = await read(
    await call(
      "/admin/packages",
      "POST",
      { ...data, name: `Target ${randomUUID()}` },
      adminCookie,
    ),
    201,
  );
  const widget = {
    id: randomUUID(),
    type: "package",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    markdown: "",
    media: null,
    alt: "",
    caption: "Recommended",
    autoplay: false,
    packageId: target.id.toUpperCase(),
    package: {
      id: target.id,
      slug: "forged",
      name: "Forged",
      description: "Forged",
      imageUrl: null,
    },
  };
  const sections = [{ id: randomUUID(), title: "Packages", widgets: [widget] }];
  const content = {
    ...data,
    name: `Owner ${randomUUID()}`,
    sections,
  };
  await read(
    await call(
      "/admin/packages",
      "POST",
      {
        ...content,
        sections: [
          { ...sections[0], widgets: [{ ...widget, packageId: randomUUID() }] },
        ],
      },
      adminCookie,
    ),
    400,
  );
  const owner = await read(
    await call("/admin/packages", "POST", content, adminCookie),
    201,
  );
  await read(
    await call(
      `/admin/packages/${target.id.toUpperCase()}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  const stored = (
    await pool.query("select canvas from packages where id = $1", [owner.id])
  ).rows[0].canvas[0].widgets[0];
  assert.equal(stored.packageId, target.id);
  assert.equal("package" in stored, false);
  const visible = await read(await call(`/packages/${owner.id}`), 200);
  assert.equal(visible.sections[0].widgets[0].package.name, target.name);
  assert.equal(visible.sections[0].widgets[0].package.imageUrl, null);
  await read(
    await call(
      `/admin/packages/${target.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  const service = await read(
    await call(
      "/admin/services",
      "POST",
      {
        name: `Owner service ${randomUUID()}`,
        description: "Coverage",
        hourlyRatePesos: 500,
        fixedPricePesos: null,
        includedHours: null,
        sections: [data.sections[0], sections[0]],
      },
      adminCookie,
    ),
    201,
  );
  await read(
    await call(`/admin/packages/${owner.id}`, "DELETE", undefined, adminCookie),
    204,
  );
  await read(
    await call(
      `/admin/packages/${target.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    409,
  );
  await read(
    await call(
      `/admin/services/${service.id}`,
      "DELETE",
      undefined,
      adminCookie,
    ),
    204,
  );
  const replacement = await read(
    await call("/admin/packages", "POST", content, adminCookie),
    201,
  );
  await read(
    await call(
      `/admin/packages/${target.id}/archive`,
      "POST",
      undefined,
      adminCookie,
    ),
    200,
  );
  const unavailable = await read(
    await call(`/packages/${replacement.id}`),
    200,
  );
  assert.equal(unavailable.sections[0].widgets[0].package, null);
  const retained = await read(
    await call(
      `/admin/packages/${replacement.id}`,
      "PATCH",
      { ...content, expectedUpdatedAt: replacement.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.equal(retained.sections[0].widgets[0].packageId, target.id);
  assert.equal(retained.sections[0].widgets[0].package, null);
  await read(
    await call(
      "/admin/packages",
      "POST",
      { ...content, name: `New link ${randomUUID()}` },
      adminCookie,
    ),
    400,
  );
});

test("only dedicated thumbnails override defaults across catalog reads and linked cards", async () => {
  for (const kind of ["packages", "services"] as const) {
    const content = {
      ...(kind === "packages"
        ? data
        : {
            description: "A service with a canvas photo",
            hourlyRatePesos: 500,
            fixedPricePesos: null,
            includedHours: null,
            sections: data.sections,
          }),
      name: `Thumbnail policy ${kind} ${randomUUID()}`,
    };
    let saved = await read(
      await call(`/admin/${kind}`, "POST", content, adminCookie),
      201,
    );
    const linkedKind = kind === "packages" ? "package" : "service";
    const owner = await read(
      await call(
        "/admin/packages",
        "POST",
        {
          ...data,
          name: `Thumbnail reference ${randomUUID()}`,
          sections: [
            {
              id: randomUUID(),
              title: "Recommended",
              widgets: [
                {
                  id: randomUUID(),
                  type: linkedKind,
                  x: 0,
                  y: 0,
                  w: 6,
                  h: 4,
                  markdown: "",
                  media: null,
                  alt: "",
                  caption: "",
                  autoplay: false,
                  [`${linkedKind}Id`]: saved.id,
                },
              ],
            },
          ],
        },
        adminCookie,
      ),
      201,
    );
    const verify = async (expected: string | null) => {
      assert.equal(saved.imageUrl, expected);
      assert.equal(
        saved.sections[0].widgets[0].media.url,
        "/images/wedding.jpg",
      );
      for (const cookie of [undefined, customerCookie, adminCookie]) {
        const detail = await read(
          await call(`/${kind}/${saved.id}`, "GET", undefined, cookie),
          200,
        );
        assert.equal(detail.imageUrl, expected);
        const page = await read(
          await call(`/${kind}?limit=15`, "GET", undefined, cookie),
          200,
        );
        assert.equal(
          page[kind].find((item: { id: string }) => item.id === saved.id)
            ?.imageUrl,
          expected,
        );
        const linked = await read(
          await call(`/packages/${owner.id}`, "GET", undefined, cookie),
          200,
        );
        assert.equal(
          linked.sections[0].widgets[0][linkedKind].imageUrl,
          expected,
        );
      }
      const adminDetail = await read(
        await call(`/admin/${kind}/${saved.id}`, "GET", undefined, adminCookie),
        200,
      );
      assert.equal(adminDetail.imageUrl, expected);
      const adminPage = await read(
        await call(`/admin/${kind}?limit=15`, "GET", undefined, adminCookie),
        200,
      );
      assert.equal(
        adminPage[kind].find((item: { id: string }) => item.id === saved.id)
          ?.imageUrl,
        expected,
      );
    };
    await verify(null);
    for (const state of ["set", "replace", "remove"] as const) {
      const thumbnail =
        state === "remove"
          ? null
          : await read(
              await uploadCanvas(
                new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
                "image/png",
              ),
              201,
            );
      saved = await read(
        await call(
          `/admin/${kind}/${saved.id}`,
          "PATCH",
          {
            ...content,
            thumbnailMediaId: thumbnail?.id ?? null,
            expectedUpdatedAt: saved.updatedAt,
          },
          adminCookie,
        ),
        200,
      );
      await verify(thumbnail?.url ?? null);
    }
  }
});

test("catalog title conflicts preserve names, slugs, and unchanged-title edits", async () => {
  const name = `Café title ${randomUUID()}`;
  for (const kind of ["packages", "services"] as const) {
    const content =
      kind === "packages"
        ? { ...data, name }
        : {
            name,
            description: "Title validation",
            hourlyRatePesos: 500,
            fixedPricePesos: null,
            includedHours: null,
            sections: data.sections,
          };
    const created = await read(
      await call(`/admin/${kind}`, "POST", content, adminCookie),
      201,
    );
    for (const conflictingName of [
      name.toUpperCase(),
      name.replace("Café", "Cafe"),
    ]) {
      await read(
        await call(
          `/admin/${kind}`,
          "POST",
          { ...content, name: conflictingName },
          adminCookie,
        ),
        409,
      );
    }
    const unchanged = await read(
      await call(
        `/admin/${kind}/${created.id}`,
        "PATCH",
        {
          ...content,
          expectedUpdatedAt: created.updatedAt,
        },
        adminCookie,
      ),
      200,
    );
    assert.equal(unchanged.slug, created.slug);
    const other = await read(
      await call(
        `/admin/${kind}`,
        "POST",
        { ...content, name: `${name} other` },
        adminCookie,
      ),
      201,
    );
    for (const conflictingName of [
      name.toUpperCase(),
      name.replace("Café", "Cafe"),
    ]) {
      await read(
        await call(
          `/admin/${kind}/${other.id}`,
          "PATCH",
          {
            ...content,
            name: conflictingName,
            expectedUpdatedAt: other.updatedAt,
          },
          adminCookie,
        ),
        409,
      );
    }
    const preserved = await read(
      await call(`/admin/${kind}/${other.id}`, "GET", undefined, adminCookie),
      200,
    );
    assert.equal(preserved.name, other.name);
    assert.equal(preserved.slug, other.slug);
    assert.equal(preserved.updatedAt, other.updatedAt);
  }
});
