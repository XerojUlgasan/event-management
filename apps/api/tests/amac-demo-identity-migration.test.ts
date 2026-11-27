import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { scenarioId } from "../src/db/seed/context.js";
import { planScenarioUsers } from "../src/db/seed/scenario/users.js";

test("fixture email migration preserves edits, unrelated accounts and collisions", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const database = `em_fixture_identity_${randomUUID().replaceAll("-", "")}`;
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  let created = false;

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    pool = new Pool({ ...connection, database });
    await pool.query(`CREATE TABLE users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE, display_name text);
      CREATE UNIQUE INDEX users_email_normalized_key ON users (lower(trim(email)));`);
    const users = planScenarioUsers();

    for (const user of users) {
      await pool.query("INSERT INTO users VALUES ($1, $2, 'Keep name')", [
        user.id,
        user.email.replace("@amac.example.test", "@clemora.example.test"),
      ]);
    }

    const demoIds = new Map<string, string>();

    for (const name of ["admin", "ana", "ben", "camille", "daniel", "ella"]) {
      const bytes = createHash("sha256")
        .update(`clemora-demo-v1:user:${name}`)
        .digest()
        .subarray(0, 16);
      bytes[6] = (bytes[6] & 15) | 80;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = bytes.toString("hex");
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      demoIds.set(name, id);
      await pool.query("INSERT INTO users VALUES ($1, $2, 'Demo')", [
        id,
        `demo.${name}@clemora.example.test`,
      ]);
    }

    // An edited fixture, a conflicting target address, and an unrelated old-domain account.
    await pool.query(
      "UPDATE users SET email = 'edited@example.test' WHERE id = $1",
      [scenarioId("user:1")],
    );
    const collision = randomUUID();
    const unrelated = randomUUID();
    await pool.query(
      "INSERT INTO users VALUES ($1, $2, 'Other'), ($3, $4, 'Other')",
      [
        collision,
        " SCENARIO.USER003@AMAC.EXAMPLE.TEST ",
        unrelated,
        "other@clemora.example.test",
      ],
    );
    const migration = await readFile(
      new URL(
        "../prisma/migrations/20261127000100_amac_demo_identity/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pool.query(migration);
    await pool.query(migration);
    const result = await pool.query<{
      id: string;
      email: string;
      display_name: string;
    }>("SELECT * FROM users");

    const byId = new Map(result.rows.map((row) => [row.id, row]));

    for (const [index, user] of users.entries()) {
      const expected =
        index === 1
          ? "edited@example.test"
          : index === 2
            ? "scenario.user003@clemora.example.test"
            : user.email;
      assert.equal(byId.get(user.id)?.email, expected);
      assert.equal(byId.get(user.id)?.display_name, "Keep name");
    }

    for (const [name, id] of demoIds)
      assert.equal(byId.get(id)?.email, `demo.${name}@amac.example.test`);

    assert.equal(
      byId.get(collision)?.email,
      " SCENARIO.USER003@AMAC.EXAMPLE.TEST ",
    );
    assert.equal(byId.get(unrelated)?.email, "other@clemora.example.test");
  } finally {
    await pool?.end();

    if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);

    await admin.end();
  }
});
