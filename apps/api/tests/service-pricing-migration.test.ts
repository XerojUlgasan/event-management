import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

const migration = "20261116090000_service_fixed_pricing";

test("service pricing migration preserves old rates and enforces fixed pricing", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_service_pricing_${randomUUID().replaceAll("-", "")}`;
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
    await pool.query(`INSERT INTO services(name,slug,description,hourly_rate_pesos)
      VALUES ('Hourly','hourly','Description',500), ('Unknown','unknown','Description',NULL)`);
    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
    const rows = await pool.query(
      "SELECT slug,hourly_rate_pesos,fixed_price_pesos,included_hours FROM services ORDER BY slug",
    );
    assert.deepEqual(rows.rows, [
      {
        slug: "hourly",
        hourly_rate_pesos: 500,
        fixed_price_pesos: null,
        included_hours: null,
      },
      {
        slug: "unknown",
        hourly_rate_pesos: null,
        fixed_price_pesos: null,
        included_hours: null,
      },
    ]);
    for (const [fixed, hours, hourly] of [
      [1000, null, 500],
      [null, 2, 500],
      [0, 2, 500],
      [1000, 0, 500],
      [1000, 2, null],
    ])
      await assert.rejects(
        pool.query(
          "UPDATE services SET fixed_price_pesos=$1,included_hours=$2,hourly_rate_pesos=$3 WHERE slug='hourly'",
          [fixed, hours, hourly],
        ),
      );
    await pool.query(
      "UPDATE services SET fixed_price_pesos=1000,included_hours=2 WHERE slug='hourly'",
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT fixed_price_pesos,included_hours,hourly_rate_pesos FROM services WHERE slug='hourly'",
        )
      ).rows[0],
      { fixed_price_pesos: 1000, included_hours: 2, hourly_rate_pesos: 500 },
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});
