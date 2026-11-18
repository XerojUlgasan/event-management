import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../src/db/types.js";
import {
  getPublicCatalogItemInputSchema,
  getPublicCatalogItemService,
  PublicCatalogItemNotFound,
} from "../../src/services/ai/get-public-catalog-item.js";
import { encodePageCursor } from "../../src/utils/pagination.js";

const database = `em_catalog_detail_${randomUUID().replaceAll("-", "")}`;
let admin: Pool | undefined;
let db: Kysely<DB>;
before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  const pool = new Pool({ ...connection, database });
  db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  const root = new URL("../../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
});
after(async () => {
  await db?.destroy();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
const widget = (
  type: "markdown" | "package" | "service" | "photo" | "video",
  extra: object,
) => ({
  id: randomUUID(),
  type,
  x: 0,
  y: 0,
  w: 12,
  h: 4,
  markdown: "",
  mediaId: null,
  alt: "",
  caption: "",
  autoplay: false,
  ...extra,
});
const canvas = (widgets: object[]) => [
  { id: randomUUID(), title: "Details", widgets },
];

test("returns current public facts and ordered canvas references with visibility gates", async () => {
  const service = await db
    .insertInto("services")
    .values({
      name: "Music",
      slug: "music",
      description: "Current service",
      fixed_price_pesos: 500,
      included_hours: 3,
      hourly_rate_pesos: 100,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const hidden = await db
    .insertInto("packages")
    .values({
      name: "Archived secret",
      slug: "archived-secret",
      description: "",
      price: 100,
      max_guests: 5,
      archived_at: new Date(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const media = await db
    .insertInto("media_assets")
    .values({ kind: "image", source: "sample", url: "/images/wedding.jpg" })
    .returning("id")
    .executeTakeFirstOrThrow();
  const video = await db
    .insertInto("media_assets")
    .values({
      kind: "video",
      source: "upload",
      storage_key: `fixture/${randomUUID()}`,
      mime_type: "video/mp4",
      byte_size: 100,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const sections = canvas([
    widget("video", {
      y: 5,
      mediaId: video.id,
      alt: "A video",
      caption: "Video caption",
    }),
    widget("photo", {
      y: 4,
      mediaId: media.id,
      alt: "A table",
      caption: "Example photo",
    }),
    widget("markdown", { y: 2, markdown: "Later text" }),
    widget("service", { y: 1, serviceId: service.id, caption: "Featured" }),
    widget("package", {
      y: 3,
      packageId: hidden.id,
      caption: "hidden caption",
    }),
    widget("markdown", { y: 0, markdown: "First text" }),
  ]);
  const pkg = await db
    .insertInto("packages")
    .values({
      name: "Celebration",
      slug: "celebration",
      description: "Current package",
      price: 1200,
      max_guests: 50,
      canvas: sql`${JSON.stringify(sections)}::jsonb`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const customer = await db
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      password_hash: "unused",
      role: "customer",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const booking = await db
    .insertInto("booking_requests")
    .values({
      reference: `fixture-${randomUUID()}`,
      customer_id: customer.id,
      package_id: pkg.id,
      event_type: "Wedding",
      preferred_date: "2027-06-01",
      time_zone: "Asia/Manila",
      guest_count: 40,
      contact_name: "Fixture",
      phone_number: "+639000000000",
      preferred_venue_location: null,
      special_requests: null,
      out_of_range: false,
      requested_days: null,
      estimated_duration_days: null,
      starts_at: null,
      ends_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const privatePackage = await db
    .insertInto("packages")
    .values({
      name: "Private",
      slug: `private-${randomUUID()}`,
      description: "",
      price: 100,
      max_guests: 5,
      package_type: "custom",
      custom_for_booking_request_id: booking.id,
      published_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await assert.rejects(
    getPublicCatalogItemService({
      db,
      input: { catalogType: "package", id: privatePackage.id },
    }),
    PublicCatalogItemNotFound,
  );
  const result = await getPublicCatalogItemService({
    db,
    input: { catalogType: "package", id: pkg.id },
  });
  assert.match(result.markdown, /Price: PHP 1200 per package/);
  assert.match(result.markdown, /Capacity: 50 guests/);
  assert.ok(
    result.markdown.includes(
      `Video: /v1/catalog-media/${video.id}\nAlt: A video\nCaption: Video caption`,
    ),
  );
  assert.match(result.markdown, /Linked service: Music/);
  assert.match(
    result.markdown,
    /Photo: \/images\/wedding.jpg[\s\S]*Alt: A table[\s\S]*Caption: Example photo/,
  );
  assert.match(result.markdown, /URL: \/services\/music/);
  assert.ok(
    result.markdown.indexOf("First text") <
      result.markdown.indexOf("Linked service"),
  );
  assert.ok(
    result.markdown.indexOf("Linked service") <
      result.markdown.indexOf("Later text"),
  );
  assert.doesNotMatch(result.markdown, /Archived secret|hidden caption/);
  assert.equal(result.nextCursor, null);
  const serviceDetail = await getPublicCatalogItemService({
    db,
    input: { catalogType: "service", id: service.id },
  });
  assert.match(
    serviceDetail.markdown,
    /Price: PHP 500 fixed[\s\S]*Included hours: 3[\s\S]*Additional hourly rate: PHP 100 per hour/,
  );
  await assert.rejects(
    getPublicCatalogItemService({
      db,
      input: { catalogType: "package", id: hidden.id },
    }),
    PublicCatalogItemNotFound,
  );
  await assert.rejects(
    getPublicCatalogItemService({
      db,
      input: { catalogType: "package", id: service.id },
    }),
    PublicCatalogItemNotFound,
  );
  assert.equal(
    getPublicCatalogItemInputSchema.safeParse({
      catalogType: "package",
      id: pkg.id,
      extra: true,
    }).success,
    false,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    getPublicCatalogItemService({
      db,
      input: { catalogType: "package", id: pkg.id },
      abortSignal: controller.signal,
    }),
  );
});

test("continuations retain Unicode text, stay bounded, and reject stale or forged cursors", async () => {
  const content = '😀"\\\t'.repeat(3500);
  const linked = await db
    .insertInto("services")
    .values({
      name: "Linked",
      slug: "linked",
      description: "",
      hourly_rate_pesos: 20,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const sections = canvas([
    widget("markdown", { markdown: content }),
    widget("service", { y: 1, serviceId: linked.id }),
  ]);
  const service = await db
    .insertInto("services")
    .values({
      name: "Long",
      slug: "long",
      description: "",
      hourly_rate_pesos: 50,
      canvas: sql`${JSON.stringify(sections)}::jsonb`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const input = { catalogType: "service" as const, id: service.id };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Unexpected provider call");
  };
  let result;
  try {
    result = await getPublicCatalogItemService({ db, input });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(result.markdown, /Price: PHP 50 per hour/);
  const initialCursor = result.nextCursor;
  assert.ok(initialCursor);
  let document = result.markdown.replace(
    /\n\n---\nComplete: false\nNext cursor: [^\n]+$/,
    "",
  );
  while (result.nextCursor) {
    result = await getPublicCatalogItemService({
      db,
      input: { ...input, cursor: result.nextCursor },
    });
    assert.ok(
      Buffer.byteLength(JSON.stringify(result, null, 2), "utf8") <= 32 * 1024,
    );
    document += result.markdown
      .replace(/^Continuation of service [^\n]+\n\n/, "")
      .replace(
        /\n\n---\nComplete: (?:true|false)(?:\nNext cursor: [^\n]+)?$/,
        "",
      );
  }
  assert.ok(document.includes(content));
  const parsedCursor = JSON.parse(
    Buffer.from(initialCursor, "base64url").toString("utf8"),
  );
  for (const offset of [1, 1000000]) {
    const cursor = encodePageCursor(parsedCursor.scope, { offset });
    await assert.rejects(
      getPublicCatalogItemService({ db, input: { ...input, cursor } }),
      (error: unknown) =>
        error instanceof Error && "status" in error && error.status === 400,
    );
  }
  await assert.rejects(
    getPublicCatalogItemService({ db, input: { ...input, cursor: "invalid" } }),
  );
  await assert.rejects(
    getPublicCatalogItemService({
      db,
      input: { ...input, cursor: encodePageCursor("wrong", { offset: 4000 }) },
    }),
  );
  await db
    .updateTable("services")
    .set({ name: "Updated linked" })
    .where("id", "=", linked.id)
    .execute();
  await assert.rejects(
    getPublicCatalogItemService({
      db,
      input: { ...input, cursor: initialCursor },
    }),
  );
});
