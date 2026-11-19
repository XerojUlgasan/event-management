import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

const migration = "20261116103220_add_catalog_knowledge";

const vector = `[${[1, ...Array<number>(767).fill(0)].join(",")}]`;

for (const extensionSchema of ["public", "extensions"]) {
  test(`catalog knowledge migration preserves sources and enforces storage/access rules (${extensionSchema})`, async (t) => {
    const host = process.env.DB_HOST ?? "localhost";
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
    const connection = {
      host,
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };
    const database = `em_catalog_knowledge_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ ...connection, database: process.env.DB_NAME });
    let pool: Pool | undefined;

    try {
      await admin.query(`CREATE DATABASE "${database}"`);
      const db = new Pool({ ...connection, database });
      pool = db;
      const root = new URL("../prisma/migrations/", import.meta.url);

      for (const entry of (await readdir(root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && entry.name < migration)
        .sort((a, b) => a.name.localeCompare(b.name)))
        await db.query(
          await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
        );

      // Exercise both a fresh extension installation and a pre-existing
      // Supabase-style extension outside the public schema.
      if (extensionSchema === "extensions") {
        await db.query("CREATE SCHEMA extensions");
        await db.query("CREATE EXTENSION vector WITH SCHEMA extensions");
      }

      const packageId = (
        await db.query<{ id: string }>(
          "INSERT INTO packages(name,slug,max_guests,price) VALUES('Fixture package','fixture-package',50,1000) RETURNING id",
        )
      ).rows[0].id;
      const serviceId = (
        await db.query<{ id: string }>(
          "INSERT INTO services(name,slug,description,hourly_rate_pesos) VALUES('Fixture service','fixture-service','Fixture description',500) RETURNING id",
        )
      ).rows[0].id;
      const mediaId = (
        await db.query<{ id: string }>(
          "INSERT INTO media_assets(kind,source,url) VALUES('image','sample','/images/wedding.jpg') RETURNING id",
        )
      ).rows[0].id;

      const sourceSnapshot = async () => {
        const sources = [];

        for (const table of ["packages", "services", "media_assets"])
          sources.push(
            (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows,
          );

        return sources;
      };

      const before = await sourceSnapshot();
      const clientRoles = (
        await db.query<{ rolname: string }>(
          "SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') ORDER BY rolname",
        )
      ).rows;
      // Reproduce permissive default grants on newly created public tables.
      await db.query(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO PUBLIC",
      );

      for (const { rolname } of clientRoles)
        await db.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${rolname}"`,
        );

      await db.query(
        await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
      );
      assert.deepEqual(await sourceSnapshot(), before);
      assert.equal(
        (await db.query("SELECT * FROM catalog_knowledge")).rowCount,
        0,
      );
      assert.equal(
        (
          await db.query(
            "SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid='public.catalog_knowledge'::regclass AND attname='embedding'",
          )
        ).rows[0].type.endsWith("vector(768)"),
        true,
      );
      assert.equal(
        (
          await db.query(
            "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector'",
          )
        ).rows[0].nspname,
        extensionSchema,
      );

      const insert = (
        packageOwner: string | null,
        serviceOwner: string | null,
        key = "overview",
        media: string | null = null,
        hash = "fixture-input-hash",
      ) =>
        db.query(
          "INSERT INTO catalog_knowledge(package_id,service_id,chunk_key,content_markdown,media_id,content_hash) VALUES($1,$2,$3,'Fixture content',$4,$5) RETURNING *",
          [packageOwner, serviceOwner, key, media, hash],
        );

      await assert.rejects(insert(null, null), { code: "23514" });
      await assert.rejects(insert(packageId, serviceId), { code: "23514" });
      await assert.rejects(insert(randomUUID(), null), { code: "23503" });
      await assert.rejects(insert(null, randomUUID()), { code: "23503" });
      await assert.rejects(
        insert(packageId, null, "missing-media", randomUUID()),
        {
          code: "23503",
        },
      );
      await assert.rejects(insert(packageId, null, " "), { code: "23514" });
      await assert.rejects(insert(packageId, null, "empty-hash", null, " "), {
        code: "23514",
      });
      const packageRow = (await insert(packageId, null)).rows[0];
      const serviceRow = (await insert(null, serviceId)).rows[0];
      assert.equal(packageRow.embedding, null);
      assert.equal(packageRow.embedding_model, null);
      assert.equal(packageRow.embedded_at, null);
      await assert.rejects(insert(packageId, null), { code: "23505" });
      await assert.rejects(insert(null, serviceId), { code: "23505" });
      const otherPackageId = (
        await db.query<{ id: string }>(
          "INSERT INTO packages(name,slug,max_guests,price) VALUES('Other fixture','other-fixture',50,1000) RETURNING id",
        )
      ).rows[0].id;
      await insert(otherPackageId, null);

      for (const [embedding, model, embeddedAt] of [
        [vector, null, null],
        [null, "fixture/embedding", null],
        [null, null, new Date()],
        [vector, "fixture/embedding", null],
        [vector, null, new Date()],
        [null, "fixture/embedding", new Date()],
        [vector, " ", new Date()],
      ])
        await assert.rejects(
          db.query(
            "UPDATE catalog_knowledge SET embedding=$1,embedding_model=$2,embedded_at=$3 WHERE id=$4",
            [embedding, model, embeddedAt, packageRow.id],
          ),
          { code: "23514" },
        );

      for (const dimensions of [767, 1536])
        await assert.rejects(
          db.query(
            "UPDATE catalog_knowledge SET embedding=$1,embedding_model='fixture/embedding',embedded_at=now() WHERE id=$2",
            [`[${Array<number>(dimensions).fill(1).join(",")}]`, packageRow.id],
          ),
          { code: "22000" },
        );

      await db.query(
        "UPDATE catalog_knowledge SET embedding=$1,embedding_model='fixture/embedding',embedded_at=now() WHERE id=$2",
        [vector, packageRow.id],
      );
      await db.query(
        "UPDATE catalog_knowledge SET content_markdown='Changed content',content_hash='changed-input',embedding=NULL,embedding_model=NULL,embedded_at=NULL WHERE id=$1",
        [packageRow.id],
      );
      const photo = (await insert(packageId, null, "photo:fixture", mediaId))
        .rows[0];
      await db.query("DELETE FROM media_assets WHERE id=$1", [mediaId]);
      assert.equal(
        (
          await db.query("SELECT id FROM catalog_knowledge WHERE id=$1", [
            photo.id,
          ])
        ).rowCount,
        0,
      );
      await db.query("DELETE FROM packages WHERE id=$1", [packageId]);
      assert.equal(
        (
          await db.query("SELECT id FROM catalog_knowledge WHERE id=$1", [
            packageRow.id,
          ])
        ).rowCount,
        0,
      );
      assert.equal(
        (
          await db.query("SELECT id FROM catalog_knowledge WHERE id=$1", [
            serviceRow.id,
          ])
        ).rowCount,
        1,
      );
      await db.query("DELETE FROM services WHERE id=$1", [serviceId]);
      assert.equal(
        (
          await db.query("SELECT id FROM catalog_knowledge WHERE id=$1", [
            serviceRow.id,
          ])
        ).rowCount,
        0,
      );

      assert.deepEqual(
        (
          await db.query(
            "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.catalog_knowledge'::regclass",
          )
        ).rows[0],
        { relrowsecurity: true, relforcerowsecurity: false },
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) acl WHERE c.oid='public.catalog_knowledge'::regclass AND acl.grantee=0",
          )
        ).rows[0].count,
        0,
      );
      const databasePool = db;

      for (const role of ["anon", "authenticated"])
        await t.test(
          `${role} cannot access knowledge`,
          {
            skip: clientRoles.some(({ rolname }) => rolname === role)
              ? false
              : "Role absent",
          },
          async () => {
            assert.equal(
              (
                await databasePool.query(
                  "SELECT has_table_privilege($1,'public.catalog_knowledge','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS allowed",
                  [role],
                )
              ).rows[0].allowed,
              false,
            );
            const client = await databasePool.connect();

            try {
              await client.query("BEGIN");
              await client.query(`SET LOCAL ROLE "${role}"`);
              await assert.rejects(
                client.query("SELECT * FROM public.catalog_knowledge"),
                { code: "42501" },
              );
            } finally {
              await client.query("ROLLBACK");
              client.release();
            }
          },
        );
    } finally {
      await pool?.end();
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await admin.end();
    }
  });
}
