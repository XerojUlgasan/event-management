import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

const migration = "20261116090100_validate_catalog_canvas_in_app";

test("application canvas validation migration removes SQL validation without changing catalog data", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_canvas_validation_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    for (const entry of (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name < migration)
      .sort((a, b) => a.name.localeCompare(b.name)))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    const canvas = [
      {
        id: randomUUID(),
        title: "Details",
        widgets: [
          {
            id: randomUUID(),
            type: "markdown",
            x: 0,
            y: 1,
            w: 12,
            h: 5,
            markdown: "Saved content",
            mediaId: null,
            alt: "",
            caption: "",
            autoplay: false,
          },
        ],
      },
    ];
    await pool.query(
      "INSERT INTO packages(name,slug,max_guests,price,canvas) VALUES ('Package','package',100,1000,$1::jsonb)",
      [JSON.stringify(canvas)],
    );
    await pool.query(
      "INSERT INTO services(name,slug,description,hourly_rate_pesos,canvas) VALUES ('Service','service','Description',500,$1::jsonb)",
      [JSON.stringify(canvas)],
    );
    const snapshots = new Map<string, unknown>();
    for (const table of ["packages", "services"])
      snapshots.set(
        table,
        (
          await pool.query(
            `SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY id`,
          )
        ).rows,
      );
    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT to_regprocedure('catalog_canvas_is_valid(jsonb)') AS name",
        )
      ).rows[0].name,
      null,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM pg_constraint WHERE conname IN ('packages_canvas_valid','services_canvas_valid')",
        )
      ).rows[0].count,
      0,
    );
    for (const table of ["packages", "services"]) {
      assert.deepEqual(
        (
          await pool.query(
            `SELECT to_jsonb(t) AS record FROM ${table} t ORDER BY id`,
          )
        ).rows,
        snapshots.get(table),
      );
      assert.equal(
        (
          await pool.query("SELECT to_regclass($1) AS name", [
            `${table}_canvas_idx`,
          ])
        ).rows[0].name,
        `${table}_canvas_idx`,
      );
      await assert.rejects(pool.query(`UPDATE ${table} SET canvas=NULL`));
      const column: { column_default: string } = (
        await pool.query<{ column_default: string }>(
          "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='canvas'",
          [table],
        )
      ).rows[0];
      assert.equal(column.column_default, "'[]'::jsonb");
    }
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});
