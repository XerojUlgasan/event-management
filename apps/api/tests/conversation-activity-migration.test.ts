import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { setTestConfig, testDatabaseUrl } from "./helpers/set-test-config.js";

const migration = "20261120124456_derive_conversation_activity";

test("derived conversation activity preserves history and makes a formerly closed booking deliverable", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const name = `em_conversation_activity_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  let runtime: typeof import("../src/db/client.js").db | undefined;

  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    pool = new Pool({ ...connection, database: name });
    const root = new URL("../prisma/migrations/", import.meta.url);

    for (const entry of (await readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && e.name < migration)
      .sort((a, b) => a.name.localeCompare(b.name)))
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );

    const customer = (
      await pool.query(
        "INSERT INTO users(email,password_hash,role) VALUES('activity-customer@example.test','unused','customer') RETURNING id",
      )
    ).rows[0].id;
    const actor = (
      await pool.query(
        "INSERT INTO users(email,password_hash,role) VALUES('activity-admin@example.test','unused','admin') RETURNING id",
      )
    ).rows[0].id;
    const pkg = (
      await pool.query(
        "INSERT INTO packages(name,slug,max_guests,price) VALUES('Activity migration','activity-migration',100,145000) RETURNING id",
      )
    ).rows[0].id;
    const booking = (
      await pool.query(
        "INSERT INTO booking_requests(reference,customer_id,package_id,event_type,preferred_date,time_zone,contact_name,phone_number,status,out_of_range) VALUES('SCN-001',$1,$2,'Wedding','2099-01-01','Asia/Manila','Fixture','00000000000','accepted',false) RETURNING id",
        [customer, pkg],
      )
    ).rows[0].id;
    const conversation = (
      await pool.query(
        "INSERT INTO conversations(customer_id,booking_request_id,status,closed_at,ai_enabled,ai_version) VALUES($1,$2,'closed',now(),false,7) RETURNING id",
        [customer, booking],
      )
    ).rows[0].id;
    const quote = (
      await pool.query(
        "INSERT INTO quotations(booking_request_id,version,base_amount_minor,total_amount_minor,created_by,offered_package_id,adjustments_reviewed) VALUES($1,1,14500000,14500000,$2,$3,true) RETURNING id",
        [booking, actor, pkg],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO messages(conversation_id,sender_id,sender_role,body) VALUES($1,$2,'customer','Keep original history')",
      [conversation, customer],
    );
    const identity = (
      await pool.query(
        "INSERT INTO guest_chat_identities(token_hash) VALUES($1) RETURNING id",
        ["a".repeat(64)],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO conversations(guest_identity_id,guest_expires_at,status,closed_at) VALUES($1,now()-interval '1 day','closed',now()),($1,now()+interval '1 day','active',null)",
      [identity],
    );
    const before = (
      await pool.query(
        "SELECT to_jsonb(c) - 'status' - 'closed_at' - 'guest_expires_at' AS row FROM conversations c ORDER BY id",
      )
    ).rows;
    const messages = (await pool.query("SELECT * FROM messages ORDER BY id"))
      .rows;
    const quotations = (
      await pool.query("SELECT * FROM quotations ORDER BY id")
    ).rows;
    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT to_jsonb(c) AS row FROM conversations c ORDER BY id",
        )
      ).rows,
      before,
    );
    assert.deepEqual(
      (await pool.query("SELECT * FROM messages ORDER BY id")).rows,
      messages,
    );
    assert.deepEqual(
      (await pool.query("SELECT * FROM quotations ORDER BY id")).rows,
      quotations,
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO conversations(customer_id,guest_identity_id) VALUES($1,$2)",
        [customer, identity],
      ),
      { code: "23514" },
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO conversations(guest_identity_id,booking_request_id) VALUES($1,$2)",
        [identity, booking],
      ),
      { code: "23514" },
    );
    await pool.query(
      "INSERT INTO conversations(guest_identity_id) VALUES($1)",
      [identity],
    );
    setTestConfig({ SUPABASE_DB_URL: testDatabaseUrl(name) });
    ({ db: runtime } = await import("../src/db/client.js"));
    const { prepareQuotationService } =
      await import("../src/services/quotations/prepare-quotation.js");
    const { sendQuotationService } =
      await import("../src/services/quotations/send-quotation.js");
    const prepared = await prepareQuotationService(runtime, booking);
    assert.ok("bookingRequestId" in prepared);
    const sentId = randomUUID();
    const sent = await sendQuotationService(runtime, booking, actor, {
      requestId: sentId,
      expectedBookingUpdatedAt: prepared.expectedBookingUpdatedAt,
      packageId: prepared.packageId,
      expectedPackageUpdatedAt: prepared.expectedPackageUpdatedAt,
      currentOffer: prepared.currentOffer,
      revisionReason: null,
      items: [],
    });
    assert.ok("status" in sent && sent.status === "sent");
    assert.equal(sent.version, 2);
    assert.equal(
      (await pool.query("SELECT status FROM quotations WHERE id=$1", [quote]))
        .rows[0].status,
      "draft",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM messages WHERE quotation_id=$1",
          [sentId],
        )
      ).rows[0].count,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT ai_enabled,ai_version FROM conversations WHERE id=$1",
          [conversation],
        )
      ).rows[0].ai_version,
      7,
    );
  } finally {
    await runtime?.destroy();
    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
