import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { sampleCatalogPhotoPaths } from "@event-management/contracts/catalog-canvas";
import { readSampleCatalogPhoto } from "../src/utils/sample-catalog-photos.js";
import { Image } from "imagescript";

test("expanded sample photo allowlist preserves media and rejects untrusted sources", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_sample_photos_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  let created = false;

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migrationName = "20261118123813_expand_catalog_sample_photos";

    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    assert.ok(entries.some((entry) => entry.name === migrationName));

    for (const entry of entries.filter((entry) => entry.name < migrationName))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );

    await pool.query(`INSERT INTO media_assets(kind,source,url)
      VALUES ('image','sample','/images/wedding.jpg')`);
    await pool.query(`INSERT INTO media_assets(kind,source,storage_key,mime_type,byte_size)
      VALUES ('image','upload','fixture/preserved.jpg','image/jpeg',1024)`);
    const before = await pool.query("SELECT * FROM media_assets ORDER BY id");
    await pool.query(
      await readFile(new URL(`${migrationName}/migration.sql`, root), "utf8"),
    );
    assert.deepEqual(
      (await pool.query("SELECT * FROM media_assets ORDER BY id")).rows,
      before.rows,
    );

    for (const url of sampleCatalogPhotoPaths) {
      await pool.query(
        "INSERT INTO media_assets(kind,source,url) VALUES ('image','sample',$1)",
        [url],
      );
      const photo = await Image.decode(await readSampleCatalogPhoto(url));
      assert.ok(photo.width > 0 && photo.height > 0);
    }

    for (const url of [
      "https://example.test/photo.jpg",
      "/images/unknown.jpg",
      "/images/../images/wedding.jpg",
    ]) {
      await assert.rejects(
        pool.query(
          "INSERT INTO media_assets(kind,source,url) VALUES ('image','sample',$1)",
          [url],
        ),
        { code: "23514" },
      );
      await assert.rejects(
        readSampleCatalogPhoto(url),
        /Unknown catalog sample/,
      );
    }

    await assert.rejects(
      pool.query(`INSERT INTO media_assets(kind,source,url)
        VALUES ('video','sample','/images/catalog-dj.jpg')`),
      { code: "23514" },
    );
    await assert.rejects(
      pool.query(`INSERT INTO media_assets(kind,source,storage_key,mime_type,byte_size)
        VALUES ('image','upload','fixture/oversized.jpg','image/jpeg',10485761)`),
      { code: "23514" },
    );
  } finally {
    await pool?.end();

    if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);

    await admin.end();
  }
});
