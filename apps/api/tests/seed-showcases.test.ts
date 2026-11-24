import "dotenv/config";
import { startSeedStorage } from "./helpers/seed-storage.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { replaceShowcaseGalleryData } from "../src/data/showcase-records/replace-showcase-gallery.js";
import { seedSampleShowcases } from "../src/db/seed-showcases.js";
import { LOCAL_PASSWORD } from "../src/db/seed/context.js";
import { showcaseDto } from "../src/services/showcase/showcase-dto.js";
import { hashPassword } from "../src/utils/password.js";

const fixtures = [
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37262",
    photos: [
      "garden-ceremony",
      "garden-bouquet",
      "garden-reception",
      "garden-place-settings",
    ],
  },
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37263",
    photos: [
      "studio-audience",
      "studio-stage",
      "studio-notes",
      "studio-discussion",
    ],
  },
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37264",
    photos: [
      "anniversary-long-table",
      "anniversary-dining-room",
      "anniversary-place-card",
      "anniversary-first-course",
    ],
  },
  {
    id: "b5f66ec3-856c-5cec-cf03-49f8e3a37265",
    photos: [
      "birthday-dining-room",
      "birthday-round-table",
      "birthday-floral-detail",
    ],
    draft: true,
  },
];

test("showcase seed uploads ordered photos and preserves an edited fixture", async (t) => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
    "Tests require local PostgreSQL",
  );
  const storage = await startSeedStorage();
  t.after(() => storage.close());
  const suffix = randomUUID().replaceAll("-", "");
  const database = `em_showcase_seed_${suffix}`;

  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let databaseCreated = false;
  let seedDb: typeof import("../src/db/client.js").db | undefined;
  t.after(async () => {
    try {
      await seedDb?.destroy();

      if (databaseCreated)
        await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  });

  await admin.query(`CREATE DATABASE "${database}"`);
  databaseCreated = true;

  const target = new Pool({ ...connection, database });

  try {
    const migrations = new URL("../prisma/migrations/", import.meta.url);

    for (const entry of (await readdir(migrations, { withFileTypes: true }))
      .filter((item) => item.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await target.query(
        await readFile(
          new URL(`${entry.name}/migration.sql`, migrations),
          "utf8",
        ),
      );
    }
  } finally {
    await target.end();
  }

  Object.assign(process.env, storage.env, { DB_NAME: database });
  const { db } = await import("../src/db/client.js");
  seedDb = db;
  const { app } = await import("../src/app.js");

  const seed = () => db.transaction().execute(seedSampleShowcases);

  const counts = await Promise.all([seed(), seed()]);
  assert.deepEqual(
    counts.sort((a, b) => a - b),
    [0, fixtures.length],
  );

  const email = "showcase-admin@example.test";
  await db
    .insertInto("users")
    .values({
      email,
      display_name: "Showcase Test Administrator",
      role: "admin",
      password_hash: await hashPassword(LOCAL_PASSWORD),
    })
    .execute();
  const login = await app.request("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: LOCAL_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);

  const response = await app.request("/v1/showcase-records");
  assert.equal(response.status, 200);
  const { showcases } = await response.json();
  assert.deepEqual(
    showcases.map(({ id }: { id: string }) => id),
    fixtures.filter(({ draft }) => !draft).map(({ id }) => id),
  );

  for (const fixture of fixtures) {
    const record = await showcaseDto(db, { id: fixture.id });
    assert.ok(record);
    assert.equal(record.publishedAt === null, fixture.draft === true);

    const urls = [record.coverUrl, ...record.media.map(({ url }) => url)];

    assert.equal(urls.length, fixture.photos.length);
    assert.equal(new Set(urls).size, urls.length);

    for (const [index, file] of fixture.photos.entries()) {
      const url = urls[index]!;
      assert.match(url, /^\/v1\/showcase-media\/[^/]+$/);

      if (fixture.draft) assert.equal((await app.request(url)).status, 404);

      const photo = await app.request(
        url,
        fixture.draft ? { headers: { cookie } } : {},
      );
      assert.equal(photo.status, 200);
      assert.equal(photo.headers.get("content-type"), "image/jpeg");
      const expected = await readFile(
        new URL(`../src/db/seed/assets/showcases/${file}.jpg`, import.meta.url),
      );
      assert.deepEqual(Buffer.from(await photo.arrayBuffer()), expected);
    }
  }

  const original = await showcaseDto(db, { id: fixtures[0]!.id });
  assert.ok(original);

  const reversed = original.media.map(({ id }) => id).reverse();

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("showcase_records")
      .set({
        title: "Admin's edited title",
        description: "Admin's edited story",
        cover_media_id: reversed[0]!,
        published_at: null,
      })
      .where("id", "=", original.id)
      .executeTakeFirstOrThrow();
    await replaceShowcaseGalleryData(trx, original.id, reversed);
  });

  const edited = await showcaseDto(db, { id: original.id });
  assert.equal(edited?.title, "Admin's edited title");

  // Model an existing admin record that already uses one of the fixture slugs.
  const draft = await showcaseDto(db, { id: fixtures.at(-1)!.id });
  assert.ok(draft);
  const manualId = randomUUID();
  await db.transaction().execute(async (trx) => {
    await replaceShowcaseGalleryData(trx, draft.id, []);
    await trx
      .updateTable("showcase_records")
      .set({ id: manualId })
      .where("id", "=", draft.id)
      .execute();
  });
  const manual = await showcaseDto(db, { id: manualId });
  assert.ok(manual);

  const mediaBefore = await db
    .selectFrom("media_assets")
    .selectAll()
    .orderBy("id")
    .execute();
  assert.equal(
    mediaBefore.length,
    fixtures.reduce((count, { photos }) => count + photos.length, 0),
  );
  assert.equal(await seed(), 0);
  assert.deepEqual(await showcaseDto(db, { id: original.id }), edited);
  assert.deepEqual(await showcaseDto(db, { id: manualId }), manual);
  assert.deepEqual(
    await db.selectFrom("media_assets").selectAll().orderBy("id").execute(),
    mediaBefore,
  );
});
