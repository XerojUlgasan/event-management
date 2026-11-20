import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

const migration = "20261120121409_remove_quotation_acceptance";

test("removing acceptance preserves current offers and rejects the retired state", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const database = `em_quote_acceptance_${randomUUID().replaceAll("-", "")}`;
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
        "INSERT INTO users(email,password_hash,role) VALUES('quote-removal@example.test','unused','customer') RETURNING id",
      )
    ).rows[0].id;
    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Retained offer','retained-offer',100,1000) RETURNING id",
      )
    ).rows[0].id;

    const booking = async (reference: string) => {
      const id = (
        await pool!.query(
          `INSERT INTO booking_requests(reference,customer_id,package_id,event_type,preferred_date,time_zone,contact_name,phone_number,status,out_of_range)
           VALUES($1,$2,$3,'Wedding','2099-01-01','Asia/Manila','Fixture','00000000000','accepted',false) RETURNING id`,
          [reference, customer, pkg],
        )
      ).rows[0].id;
      const conversation = (
        await pool!.query(
          "INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id",
          [customer, id],
        )
      ).rows[0].id;

      return { id, conversation };
    };

    const first = await booking("CURRENT-OFFERS");
    const second = await booking("OTHER-BOOKING");

    const quote = async (
      parent: typeof first,
      version: number,
      status: string,
      previous: string | null = null,
    ) => {
      const id = (
        await pool!.query(
          `INSERT INTO quotations(booking_request_id,version,base_amount_minor,total_amount_minor,created_by,offered_package_id,status,sent_at,superseded_at,previous_quotation_id,revision_reason)
           VALUES($1,$2,100000,100000,$3,$4,$5,
             CASE WHEN $5='draft' THEN NULL ELSE '2026-11-01T00:00:00Z'::timestamptz END,
             CASE WHEN $5='superseded' THEN '2026-11-03T00:00:00Z'::timestamptz END,
             $6,CASE WHEN $6::uuid IS NULL THEN NULL ELSE 'Revised scope' END) RETURNING id`,
          [parent.id, version, customer, pkg, status, previous],
        )
      ).rows[0].id;

      if (status !== "draft")
        await pool!.query(
          "INSERT INTO messages(conversation_id,sender_id,sender_role,body,quotation_id) VALUES($1,$2,'customer','Retained exact-version offer',$3)",
          [parent.conversation, customer, id],
        );

      await pool!.query(
        "INSERT INTO audit_events(actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'quotation',$3,'{}')",
        [
          customer,
          status === "draft" ? "quotation.created" : "quotation.sent",
          id,
        ],
      );

      return id;
    };

    const oldHistory = await quote(first, 1, "superseded");
    const current = await quote(first, 2, "sent", oldHistory);
    const draft = await quote(first, 3, "draft", current);
    const sent = await quote(second, 1, "sent");

    const snapshot = async (table: string) =>
      (
        await pool!.query(
          `SELECT to_jsonb(t)${table === "quotations" ? " - 'accepted_at'" : ""} AS row FROM ${table} t ORDER BY id`,
        )
      ).rows.map((entry) => entry.row);

    const retained = [
      "users",
      "packages",
      "booking_requests",
      "conversations",
      "messages",
      "audit_events",
      "quotations",
    ];

    const before = new Map(
      await Promise.all(
        retained.map(async (table) => [table, await snapshot(table)] as const),
      ),
    );

    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );

    for (const table of retained)
      assert.deepEqual(await snapshot(table), before.get(table), table);

    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='quotations' AND column_name='accepted_at'",
        )
      ).rows[0].count,
      0,
    );

    assert.equal(
      (
        await pool.query(
          "SELECT to_regclass('public.quotations_one_accepted_per_booking') AS name",
        )
      ).rows[0].name,
      null,
    );
    await assert.rejects(
      pool.query("UPDATE quotations SET status='accepted' WHERE id=$1", [
        current,
      ]),
      { code: "23514" },
    );
    await assert.rejects(
      pool.query("UPDATE quotations SET status='sent' WHERE id=$1", [draft]),
      { code: "23505" },
    );
    await assert.rejects(
      pool.query("UPDATE quotations SET previous_quotation_id=$2 WHERE id=$1", [
        draft,
        sent,
      ]),
      { code: "23514" },
    );
    await pool.query(
      "UPDATE quotations SET items=$2,total_amount_minor=-50000 WHERE id=$1",
      [
        draft,
        JSON.stringify([
          {
            id: randomUUID(),
            direction: "deduct",
            kind: "deduction",
            description: "Draft adjustment",
            amountMinor: 150000,
            serviceId: null,
          },
        ]),
      ],
    );
    await assert.rejects(
      pool.query(
        "UPDATE quotations SET items=$2,total_amount_minor=-50000 WHERE id=$1",
        [
          current,
          JSON.stringify([
            {
              id: randomUUID(),
              direction: "deduct",
              kind: "deduction",
              description: "Invalid sent adjustment",
              amountMinor: 150000,
              serviceId: null,
            },
          ]),
        ],
      ),
      { code: "23514" },
    );
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
