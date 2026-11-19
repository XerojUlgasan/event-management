import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

test("RLS migration preserves server access and closes direct client table access", async (t) => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    "Tests require local PostgreSQL",
  );
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_rls_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);
    const migrationName = "20261109140000_enable_application_rls";

    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name < migrationName)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    }

    const migration = await readFile(
      new URL(`${migrationName}/migration.sql`, root),
      "utf8",
    );
    const user = (
      await pool.query(
        "INSERT INTO users(email,password_hash) VALUES('rls@example.test','unused') RETURNING id",
      )
    ).rows[0];
    const clientRoles = await pool.query<{ rolname: string }>(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname",
    );
    await pool.query("GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC");

    for (const { rolname } of clientRoles.rows) {
      // Reproduce the grants present on Supabase-created public schemas.
      await pool.query(
        `GRANT ALL ON ALL TABLES IN SCHEMA public TO "${rolname}"`,
      );
    }

    await pool.query(migration);
    const tables = await pool.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      "SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname",
    );
    assert.equal(tables.rowCount, 13);

    for (const table of tables.rows) {
      assert.equal(table.relrowsecurity, true, `${table.relname} enables RLS`);
      assert.equal(
        table.relforcerowsecurity,
        false,
        `${table.relname} preserves owner access`,
      );
    }

    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM pg_policy WHERE polrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)",
        )
      ).rows[0].count,
      0,
    );
    assert.deepEqual((await pool.query("SELECT id FROM users")).rows, [user]);
    await pool.query(
      "UPDATE users SET display_name='Still writable by server' WHERE id=$1",
      [user.id],
    );

    // Prisma creates this table before applying migrations; SQL replay does not.
    await pool.query("CREATE TABLE _prisma_migrations(id text PRIMARY KEY)");
    await pool.query(
      "INSERT INTO _prisma_migrations VALUES('retained-history')",
    );
    await pool.query("GRANT ALL ON _prisma_migrations TO PUBLIC");

    for (const { rolname } of clientRoles.rows) {
      await pool.query(`GRANT ALL ON _prisma_migrations TO "${rolname}"`);
    }

    await pool.query(migration);
    assert.equal(
      (
        await pool.query(
          "SELECT relrowsecurity FROM pg_class WHERE oid='public._prisma_migrations'::regclass",
        )
      ).rows[0].relrowsecurity,
      true,
    );
    assert.equal(
      (await pool.query("SELECT id FROM _prisma_migrations")).rows[0].id,
      "retained-history",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) acl WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND acl.grantee=0",
        )
      ).rows[0].count,
      0,
      "PUBLIC table grants are removed",
    );

    const databasePool = pool;

    for (const rolname of ["anon", "authenticated"]) {
      await t.test(
        `${rolname} cannot read or truncate application tables`,
        {
          skip: clientRoles.rows.some((role) => role.rolname === rolname)
            ? false
            : "Role absent; run against local Supabase to verify client denial",
        },
        async () => {
          const grants: { relname: string; has_access: boolean }[] = (
            await databasePool.query(
              "SELECT relname,has_table_privilege($1,oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS has_access FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'",
              [rolname],
            )
          ).rows;

          for (const grant of grants)
            assert.equal(
              grant.has_access,
              false,
              `${rolname} has no ${grant.relname} grants`,
            );

          const client = await databasePool.connect();

          try {
            await client.query("BEGIN");
            await client.query(`SET LOCAL ROLE "${rolname}"`);
            await assert.rejects(client.query("SELECT id FROM users"), {
              code: "42501",
            });
            await client.query("ROLLBACK");
            await client.query("BEGIN");
            await client.query(`SET LOCAL ROLE "${rolname}"`);
            await assert.rejects(client.query("TRUNCATE sessions"), {
              code: "42501",
            });
          } finally {
            await client.query("ROLLBACK");
            client.release();
          }
        },
      );
    }

    assert.equal(
      (
        await pool.query("SELECT display_name FROM users WHERE id=$1", [
          user.id,
        ])
      ).rows[0].display_name,
      "Still writable by server",
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
