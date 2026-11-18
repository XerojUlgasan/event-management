import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool, type QueryResult } from "pg";

test("thumbnail migrations replay in order and retain media foreign keys", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_thumbnail_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    for (const entry of (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    }
    for (const table of ["packages", "services"]) {
      const foreignKey: QueryResult<{ target: string; confdeltype: string }> =
        await pool.query(
          "SELECT confrelid::regclass::text AS target, confdeltype FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2",
          [table, `${table}_thumbnail_media_id_fkey`],
        );
      assert.deepEqual(foreignKey.rows, [
        { target: "media_assets", confdeltype: "n" },
      ]);
      assert.equal(
        (
          await pool.query("SELECT to_regclass($1)::text AS name", [
            `${table}_thumbnail_media_id_idx`,
          ])
        ).rows[0].name,
        `${table}_thumbnail_media_id_idx`,
      );
    }
    await pool.query(
      "INSERT INTO packages(name,slug,max_guests,price) VALUES ('Package','package',100,1000)",
    );
    await pool.query(
      "INSERT INTO services(name,slug,description) VALUES ('Service','service','Description')",
    );
    const mediaId = (
      await pool.query<{ id: string }>(
        "INSERT INTO media_assets(kind,source,url) VALUES('image','sample','/images/wedding.jpg') RETURNING id",
      )
    ).rows[0].id;
    for (const table of ["packages", "services"]) {
      await assert.rejects(
        pool.query(`UPDATE ${table} SET thumbnail_media_id=$1`, [randomUUID()]),
        { code: "23503" },
      );
      await pool.query(`UPDATE ${table} SET thumbnail_media_id=$1`, [mediaId]);
    }
    await pool.query("DELETE FROM media_assets WHERE id=$1", [mediaId]);
    for (const table of ["packages", "services"]) {
      assert.equal(
        (await pool.query(`SELECT thumbnail_media_id FROM ${table}`)).rows[0]
          .thumbnail_media_id,
        null,
      );
    }
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});
