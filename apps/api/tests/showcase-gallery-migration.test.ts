import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

function readMigration(name: string) {
  return readFile(
    new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
    "utf8",
  );
}

test("showcase gallery migration preserves attachments and refuses shared ownership", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_showcase_gallery_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database, max: 1 });
    await pool.query(`
      CREATE TABLE users (id UUID PRIMARY KEY);
      CREATE TABLE media_assets (id UUID PRIMARY KEY, storage_key TEXT);
    `);
    await pool.query(await readMigration("20261120120000_add_showcase"));

    const [cover, photo, video, preview] = Array.from({ length: 4 }, () =>
      randomUUID(),
    );

    const existing = "b5f66ec3-856c-5cec-cf03-49f8e3a37262";
    const draft = randomUUID();
    await pool.query(
      `INSERT INTO media_assets (id, storage_key)
       VALUES ($1, 'cover'), ($2, 'photo'), ($3, 'video'), ($4, 'preview')`,
      [cover, photo, video, preview],
    );
    await pool.query(
      `INSERT INTO showcase_records (id, slug, title, description, cover_media_id, preview_video_id, published_at)
       VALUES ($1, 'existing', 'Existing record', 'Description', $3, $4, now()),
              ($2, 'draft', 'Draft record', 'Description', $3, NULL, NULL)`,
      [existing, draft, cover, preview],
    );
    await pool.query(
      `INSERT INTO showcase_record_media (record_id, media_id, sort_order)
       VALUES ($1, $3, 2), ($1, $4, 5), ($2, $3, 0)`,
      [existing, draft, photo, video],
    );

    const migration = await readMigration(
      "20261124120000_move_showcase_gallery_to_media_assets",
    );
    await assert.rejects(
      pool.query(migration),
      /belongs to multiple showcases/,
    );
    await pool.query("ROLLBACK");
    assert.equal(
      (await pool.query("SELECT * FROM showcase_record_media")).rowCount,
      3,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT preview_video_id FROM showcase_records WHERE id = $1",
          [existing],
        )
      ).rows[0].preview_video_id,
      preview,
    );

    await pool.query("DELETE FROM showcase_record_media WHERE record_id = $1", [
      draft,
    ]);
    await pool.query(migration);

    const { rows: assets } = await pool.query(
      "SELECT * FROM media_assets ORDER BY gallery_position NULLS LAST, storage_key",
    );
    assert.deepEqual(assets, [
      {
        id: photo,
        storage_key: "photo",
        showcase_record_id: existing,
        gallery_position: 2,
      },
      {
        id: video,
        storage_key: "video",
        showcase_record_id: existing,
        gallery_position: 5,
      },
      {
        id: cover,
        storage_key: "cover",
        showcase_record_id: null,
        gallery_position: null,
      },
      {
        id: preview,
        storage_key: "preview",
        showcase_record_id: null,
        gallery_position: null,
      },
    ]);
    const { rows: records } = await pool.query(
      "SELECT id, cover_media_id FROM showcase_records ORDER BY slug",
    );
    assert.deepEqual(records, [
      { id: draft, cover_media_id: cover },
      { id: existing, cover_media_id: cover },
    ]);
    await assert.rejects(pool.query("SELECT * FROM showcase_record_media"), {
      code: "42P01",
    });
    await assert.rejects(
      pool.query("SELECT preview_video_id FROM showcase_records"),
      { code: "42703" },
    );
    await assert.rejects(
      pool.query("UPDATE media_assets SET gallery_position = 1 WHERE id = $1", [
        preview,
      ]),
      { code: "23514" },
    );
    await assert.rejects(
      pool.query("UPDATE media_assets SET gallery_position = 2 WHERE id = $1", [
        video,
      ]),
      { code: "23505" },
    );
    await assert.rejects(
      pool.query("DELETE FROM showcase_records WHERE id = $1", [existing]),
      { code: "23503" },
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});
