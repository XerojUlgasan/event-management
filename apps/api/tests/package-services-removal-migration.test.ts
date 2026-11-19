import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

const migration = "20261118121512_remove_package_services";

test("removing service assignments preserves source records and canvas references", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_remove_service_links_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;

  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    pool = new Pool({ ...connection, database });
    const root = new URL("../prisma/migrations/", import.meta.url);

    const entries = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries.filter((entry) => entry.name < migration))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );

    const customer = (
      await pool.query(
        "INSERT INTO users(email,password_hash,role) VALUES('remove-links@example.test','unused','customer') RETURNING id",
      )
    ).rows[0].id;
    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Retained package','retained-package',100,1000) RETURNING id",
      )
    ).rows[0].id;
    const unrelated = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Unrelated package','unrelated-package',50,500) RETURNING id",
      )
    ).rows[0].id;
    const service = (
      await pool.query(
        "INSERT INTO services(name,slug,description,hourly_rate_pesos) VALUES('Retained service','retained-service','Description',500) RETURNING id",
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO package_services(package_id,service_id,role,sort_order) VALUES($1,$2,'included',0)",
      [pkg, service],
    );

    const widget = (type: string, reference: object) => ({
      id: randomUUID(),
      type,
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      markdown: "",
      alt: "",
      caption: "Retained reference",
      autoplay: false,
      mediaId: null,
      ...reference,
    });

    await pool.query("UPDATE packages SET canvas=$2::jsonb WHERE id=$1", [
      pkg,
      JSON.stringify([
        {
          id: randomUUID(),
          title: "Services",
          widgets: [widget("service", { serviceId: service })],
        },
      ]),
    ]);
    await pool.query("UPDATE services SET canvas=$2::jsonb WHERE id=$1", [
      service,
      JSON.stringify([
        {
          id: randomUUID(),
          title: "Packages",
          widgets: [widget("package", { packageId: pkg })],
        },
      ]),
    ]);
    const booking = (
      await pool.query(
        `INSERT INTO booking_requests(reference,customer_id,package_id,event_type,preferred_date,time_zone,contact_name,phone_number,out_of_range)
         VALUES('REMOVE-LINKS',$1,$2,'Wedding','2099-01-01','Asia/Manila','Fixture','00000000000',false) RETURNING id`,
        [customer, pkg],
      )
    ).rows[0].id;
    await pool.query(
      `INSERT INTO quotations(booking_request_id,version,created_by,offered_package_id,base_amount_minor,total_amount_minor)
       VALUES($1,1,$2,$3,100000,100000)`,
      [booking, customer, pkg],
    );
    await pool.query(
      `INSERT INTO audit_events(actor_id,action,entity_type,entity_id,metadata)
       VALUES($1,'fixture','package',$2,'{"historical":true}')`,
      [customer, pkg],
    );

    for (const [owner, key, content] of [
      [pkg, "overview", "Old included service text"],
      [pkg, "overview:1", "Old split overview text"],
      [pkg, "service:caption", "Retained widget caption"],
      [unrelated, "overview", "Unrelated overview"],
    ])
      await pool.query(
        `INSERT INTO catalog_knowledge(package_id,chunk_key,content_markdown,content_hash)
         VALUES($1,$2,$3,'fixture-hash')`,
        [owner, key, content],
      );

    const snapshot = async () => {
      const result: Record<string, unknown> = {};

      for (const table of [
        "packages",
        "services",
        "users",
        "booking_requests",
        "quotations",
        "audit_events",
        "media_assets",
      ])
        result[table] = (
          await pool!.query(
            `SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY id), '[]'::jsonb) AS rows FROM ${table} t`,
          )
        ).rows[0].rows;

      return result;
    };

    const before = await snapshot();
    const retainedKnowledge = (
      await pool.query(
        "SELECT * FROM catalog_knowledge WHERE chunk_key NOT IN ('overview','overview:1') OR package_id=$1 ORDER BY id",
        [unrelated],
      )
    ).rows;
    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT to_regclass('public.package_services') AS table_name",
        )
      ).rows[0].table_name,
      null,
    );
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(
      (await pool.query("SELECT * FROM catalog_knowledge ORDER BY id")).rows,
      retainedKnowledge,
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
