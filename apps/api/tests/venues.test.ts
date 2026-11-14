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
  await db?.destroy();
  await pool?.end();
  if (admin) {
    // pg-pool may resolve end() before every idle socket has disconnected.
    // Wait for disconnects instead of forcibly terminating those sockets.
    for (let attempt = 0; attempt < 100; attempt++) {
      const active = await admin.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1",
        [database],
      );
      if (active.rows[0].count === 0) break;
      await delay(10);
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
async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return status === 204
    ? null
    : response.headers.get("Content-Type")?.startsWith("image/")
      ? response.arrayBuffer()
      : response.json();
}

const content = {
  name: "  Garden  ",
  location: "  City  ",
  description: "  Venue description  ",
  maxGuests: 100,
};
const photo = (name: string) => `https://images.example.test/${name}.jpg`;

test("public venue capacity filter includes the boundary and binds cursors", async () => {
  const venues: { id: string }[] = [];
  for (const [index, capacity] of [
    [0, 765000],
    [1, 765000],
    [2, 765001],
  ]) {
    venues.push(
      await read(
        await call(
          "/admin/venues",
          "POST",
          {
            ...content,
            name: `Filter venue ${index}`,
            maxGuests: capacity,
          },
          adminCookie,
        ),
        201,
      ),
    );
  }
  await pool.query("UPDATE venues SET max_guests = NULL WHERE id = $1", [
    venues[2].id,
  ]);
  const first = await read(await call("/venues?limit=1&guests=765000"), 200);
  assert.ok(first.nextCursor);
  const second = await read(
    await call(
      `/venues?limit=1&guests=765000&cursor=${encodeURIComponent(first.nextCursor)}`,
    ),
    200,
  );
  assert.deepEqual(
    new Set([first.venues[0].id, second.venues[0].id]),
    new Set(venues.slice(0, 2).map((v) => v.id)),
  );
  assert.equal(second.nextCursor, null);
  await read(
    await call(
      `/venues?guests=765001&cursor=${encodeURIComponent(first.nextCursor)}`,
    ),
    400,
  );
  const unfiltered = await read(await call("/venues?limit=50"), 200);
  assert.ok(
    unfiltered.venues.some((v: { id: string }) => v.id === venues[2].id),
  );
  for (const query of [
    "guests=",
    "guests=0",
    "guests=1.5",
    "guests=2147483648",
    "minPricePesos=0",
    "maxPricePesos=0",
  ]) {
    await read(await call(`/venues?${query}`), 400);
  }
});

test("venue catalog requires complete content and protects admin operations", async () => {
  const created = await read(
    await call("/admin/venues", "POST", content, adminCookie),
    201,
  );
  const path = `/admin/venues/${created.id}`;
  const routes: [string, string, unknown?][] = [
    ["/admin/venues", "GET"],
    [path, "GET"],
    ["/admin/venues", "POST", content],
    [path, "PATCH", { ...content, expectedUpdatedAt: created.updatedAt }],
    [`${path}/archive`, "POST"],
    [path, "DELETE"],
  ];
  for (const [url, method, body] of routes) {
    await read(await call(url, method, body), 401);
    for (const cookie of [staffCookie, customerCookie, undesignatedAdminCookie])
      await read(await call(url, method, body, cookie), 403);
  }
  for (const invalid of [
    { ...content, name: "" },
    { ...content, location: "" },
    { ...content, description: "" },
    { ...content, maxGuests: null },
    { ...content, maxGuests: 0 },
    { ...content, maxGuests: 1.5 },
    { ...content, categories: [] },
    { ...content, capacityMax: 100 },
    { ...content, imageUrls: ["http://example.test/image.png"] },
    { ...content, imageUrls: Array(11).fill(photo("excess")) },
    { ...content, imageUrls: [`/v1/venue-images/${randomUUID()}`] },
  ])
    await read(await call("/admin/venues", "POST", invalid, adminCookie), 400);
  await read(await call("/venues/not-a-uuid"), 400);
  await read(await call("/venues?limit=51"), 400);
  await read(await call("/venues?cursor=invalid"), 400);
  await read(
    await call(
      "/admin/venues",
      "POST",
      content,
      adminCookie,
      "https://untrusted.example",
    ),
    403,
  );
  await read(await call(path, "DELETE", undefined, adminCookie), 204);
});

test("venues save directly, publish edits immediately and reject stale or archived writes", async () => {
  const created = await read(
    await call("/admin/venues", "POST", content, adminCookie),
    201,
  );
  const path = `/admin/venues/${created.id}`;
  assert.equal(created.name, "Garden");
  assert.equal(created.location, "City");
  assert.equal(created.maxGuests, 100);
  assert.ok(created.publishedAt);
  for (const key of [
    "draft",
    "published",
    "versions",
    "version",
    "state",
    "capacityMin",
    "capacityMax",
    "categories",
    "imageUrls",
  ])
    assert.equal(key in created, false);
  assert.equal(
    (await read(await call(`/venues/${created.id}`), 200)).name,
    "Garden",
  );
  const edited = await read(
    await call(
      path,
      "PATCH",
      { ...content, name: "Changed", expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    200,
  );
  const visible = await read(await call(`/venues/${created.id}`), 200);
  assert.equal(visible.name, "Changed");
  assert.equal(visible.maxGuests, 100);
  await read(
    await call(
      path,
      "PATCH",
      { ...content, expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    409,
  );
  await read(
    await call(`${path}/archive`, "POST", undefined, adminCookie),
    200,
  );
  await read(await call(`/venues/${created.id}`), 404);
  assert.ok(
    (await read(await call(path, "GET", undefined, adminCookie), 200))
      .archivedAt,
  );
  await read(
    await call(
      path,
      "PATCH",
      { ...content, expectedUpdatedAt: edited.updatedAt },
      adminCookie,
    ),
    409,
  );
  await read(await call(path, "DELETE", undefined, adminCookie), 204);
  await read(await call(path, "GET", undefined, adminCookie), 404);
  const live = await read(
    await call("/admin/venues", "POST", content, adminCookie),
    201,
  );
  await read(
    await call(`/admin/venues/${live.id}`, "DELETE", undefined, adminCookie),
    204,
  );
  await read(await call(`/venues/${live.id}`), 404);
});

test("venue canvas photos keep order and pagination is stable", async () => {
  const sections = [
    {
      id: randomUUID(),
      title: "Gallery",
      widgets: ["/images/wedding.jpg", "/images/dinner.jpg"].map((url, i) => ({
        id: randomUUID(),
        type: "photo",
        x: i === 0 ? 0 : 7,
        y: i === 0 ? 0 : 13,
        w: i === 0 ? 4 : 5,
        h: i === 0 ? 6 : 7,
        markdown: "",
        media: { kind: "image", source: "sample", url },
        alt: "Venue photo",
        caption: "",
      })),
    },
  ];
  const created = await read(
    await call("/admin/venues", "POST", { ...content, sections }, adminCookie),
    201,
  );
  const detail = await read(await call(`/venues/${created.id}`), 200);
  assert.deepEqual(
    detail.sections[0].widgets.map((w: any) => w.media.url),
    ["/images/wedding.jpg", "/images/dinner.jpg"],
  );
  assert.deepEqual(
    detail.sections[0].widgets.map((w: any) => [w.x, w.y, w.w, w.h]),
    [
      [0, 0, 4, 6],
      [7, 13, 5, 7],
    ],
  );
  const edited = await read(
    await call(
      `/admin/venues/${created.id}`,
      "PATCH",
      { ...content, expectedUpdatedAt: created.updatedAt },
      adminCookie,
    ),
    200,
  );
  assert.deepEqual(edited.sections, detail.sections);
  assert.deepEqual(
    edited.sections[0].widgets.map((w: any) => [w.x, w.y, w.w, w.h]),
    [
      [0, 0, 4, 6],
      [7, 13, 5, 7],
    ],
  );
  for (let i = 0; i < 17; i++)
    await read(
      await call(
        "/admin/venues",
        "POST",
        { ...content, name: `Pagination ${String(i).padStart(2, "0")}` },
        adminCookie,
      ),
      201,
    );
  const all = (await read(await call("/venues?limit=50"), 200)).venues;
  const page1 = await read(await call("/venues?limit=15"), 200);
  assert.equal(page1.venues.length, 15);
  assert.ok(page1.nextCursor);
  const page2 = await read(
    await call(
      `/venues?limit=15&cursor=${encodeURIComponent(page1.nextCursor)}`,
    ),
    200,
  );
  assert.equal(page2.nextCursor, null);
  assert.deepEqual(
    [...page1.venues, ...page2.venues].map((v: any) => v.id),
    all.map((v: any) => v.id),
  );
  await read(
    await call(`/packages?cursor=${encodeURIComponent(page1.nextCursor)}`),
    400,
  );
  const filtered = await read(
    await call(
      "/admin/venues?limit=2&archived=active&search=Pagination",
      "GET",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.equal(filtered.venues.length, 2);
  assert.equal(filtered.counts.filtered, 17);
  await read(
    await call(
      `/admin/venues?archived=archived&search=Pagination&cursor=${encodeURIComponent(filtered.nextCursor)}`,
      "GET",
      undefined,
      adminCookie,
    ),
    400,
  );
  await read(
    await call(`/admin/venues/${created.id}`, "DELETE", undefined, adminCookie),
    204,
  );
});

test("concurrent venue edits have one winner and obsolete routes are absent", async () => {
  const created = await read(
    await call("/admin/venues", "POST", content, adminCookie),
    201,
  );
  const path = `/admin/venues/${created.id}`;
  const responses = await Promise.all(
    ["First", "Second"].map((name) =>
      call(
        path,
        "PATCH",
        { ...content, name, expectedUpdatedAt: created.updatedAt },
        adminCookie,
      ),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  for (const response of responses) await response.text();
  const saved = await read(
    await call(path, "GET", undefined, adminCookie),
    200,
  );
  assert.ok(["First", "Second"].includes(saved.name));
  for (const suffix of ["draft", "publish"])
    assert.equal(
      (
        await call(
          `${path}/${suffix}`,
          suffix === "draft" ? "PATCH" : "POST",
          {},
          adminCookie,
        )
      ).status,
      404,
    );
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/admin/venues/{id}"].patch);
  assert.ok(spec.paths["/v1/admin/venues/{id}"].delete);
  assert.ok(spec.paths["/v1/admin/venues/{id}/archive"]);
  const input =
    spec.paths["/v1/admin/venues"].post.requestBody.content["application/json"]
      .schema;
  const output =
    spec.paths["/v1/admin/venues"].post.responses["201"].content[
      "application/json"
    ].schema;
  assert.ok(input.required.includes("maxGuests"));
  for (const key of ["categories", "capacityMax", "imageUrls"]) {
    assert.equal(key in input.properties, false);
    assert.equal(key in output.properties, false);
  }
  assert.equal(spec.paths["/v1/admin/venues/{id}/draft"], undefined);
  assert.equal(spec.paths["/v1/admin/venues/{id}/publish"], undefined);
});
