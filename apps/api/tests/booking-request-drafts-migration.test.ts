import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import {
  bookingDraftFieldsSchema,
  reviewedServiceSchema,
} from "@event-management/contracts/booking-draft";
import { setTestConfig } from "./helpers/set-test-config.js";

const migration = "20261122010000_booking_request_drafts";

test("forward migration preserves submitted requests, active drafts and historical reviews", async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const name = `em_draft_migration_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ ...connection, database: process.env.DB_NAME });
  let pool: Pool | undefined;
  let runtime: typeof import("../src/db/client.js").db | undefined;
  const previousDbName = process.env.DB_NAME;

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
        "INSERT INTO users(email,password_hash,role) VALUES('migration@example.test','unused','customer') RETURNING id",
      )
    ).rows[0].id;
    const guest = (
      await pool.query(
        "INSERT INTO guest_chat_identities(token_hash) VALUES($1) RETURNING id",
        ["a".repeat(64)],
      )
    ).rows[0].id;
    const submitted = (
      await pool.query(
        `INSERT INTO booking_requests(reference,customer_id,event_type,preferred_date,time_zone,contact_name,phone_number,out_of_range,special_requests,intake_details) VALUES('OLD-001',$1,'Wedding','2099-01-01','Asia/Manila','Customer','123',false,'Quiet room',$2) RETURNING id, created_at`,
        [
          customer,
          {
            requestedServices: [
              {
                serviceId: null,
                name: "Host",
                hours: 2,
                notes: "Bilingual",
                included: false,
                updatedAt: null,
              },
            ],
            budget: "PHP 50000",
            preferences: "Blue decor",
          },
        ],
      )
    ).rows[0];
    const guestChat = (
      await pool.query(
        "INSERT INTO conversations(guest_identity_id) VALUES($1) RETURNING id",
        [guest],
      )
    ).rows[0].id;
    const customerChat = (
      await pool.query(
        "INSERT INTO conversations(customer_id) VALUES($1) RETURNING id",
        [customer],
      )
    ).rows[0].id;
    const discardedChat = (
      await pool.query(
        "INSERT INTO conversations(customer_id) VALUES($1) RETURNING id",
        [customer],
      )
    ).rows[0].id;
    const submittedChat = (
      await pool.query(
        "INSERT INTO conversations(customer_id,booking_request_id) VALUES($1,$2) RETURNING id",
        [customer, submitted.id],
      )
    ).rows[0].id;
    const fields = {
      eventType: "Anniversary",
      durationMode: "multi_day",
      requestedDates: ["2099-07-13", "2099-07-11"],
      timeZone: "Asia/Manila",
      guestCount: 75,
      contactName: "Customer",
      phoneNumber: "123",
      preferredVenueLocation: "Venue",
      specialRequests: "Quiet room",
      preferences: "Blue decor",
      budget: "PHP 50000",
      requestedServices: [
        { customName: "Acoustic duo", hours: 2, notes: "Evening" },
      ],
    };
    const longNotes = `${"A".repeat(4000)}\n${"B".repeat(4000)}`;
    const longFields = {
      ...fields,
      specialRequests: "A".repeat(4000),
      preferences: "B".repeat(4000),
    };
    const review = {
      revision: 3,
      fields,
      selectedPackage: null,
      requestedServices: [
        {
          serviceId: null,
          name: "Acoustic duo",
          hours: 2,
          notes: "Evening",
          included: false,
          updatedAt: null,
        },
      ],
      warnings: ["Dates are not reserved"],
      intakeDetails: {
        requestedServices: [],
        budget: "PHP 50000",
        preferences: "Blue decor",
      },
    };
    const message = (
      await pool.query(
        "INSERT INTO messages(conversation_id,sender_role,body,booking_review) VALUES($1,'assistant','Please confirm',$2) RETURNING id",
        [customerChat, review],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO conversation_booking_drafts(conversation_id,status,payload,review_message_id) VALUES($1,'collecting',$7,NULL),($3,'awaiting_confirmation',$2,$4),($5,'discarded',$2,NULL),($6,'submitted',$2,NULL)",
      [
        guestChat,
        fields,
        customerChat,
        message,
        discardedChat,
        submittedChat,
        longFields,
      ],
    );

    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
    const old = (
      await pool.query("SELECT * FROM booking_requests WHERE id=$1", [
        submitted.id,
      ])
    ).rows[0];
    assert.equal(
      old.submitted_at.toISOString(),
      submitted.created_at.toISOString(),
    );
    assert.equal(old.budget, "PHP 50000");
    assert.equal(old.special_requests, "Quiet room\nBlue decor");
    assert.equal(old.requested_services[0].name, "Host");
    reviewedServiceSchema.parse(old.requested_services[0]);
    const chats = (
      await pool.query(
        "SELECT id,customer_id,guest_identity_id,booking_request_id FROM conversations WHERE id=ANY($1::uuid[])",
        [[guestChat, customerChat, discardedChat, submittedChat]],
      )
    ).rows;

    const byId = new Map(chats.map((row) => [row.id, row]));

    assert.equal(byId.get(guestChat).guest_identity_id, guest);
    assert.equal(byId.get(guestChat).customer_id, null);
    assert.equal(byId.get(discardedChat).booking_request_id, null);
    assert.equal(byId.get(submittedChat).booking_request_id, submitted.id);
    const drafts = (
      await pool.query(
        "SELECT * FROM booking_requests WHERE id=ANY($1::uuid[]) ORDER BY customer_id NULLS FIRST",
        [
          [
            byId.get(guestChat).booking_request_id,
            byId.get(customerChat).booking_request_id,
          ],
        ],
      )
    ).rows;
    assert.equal(drafts.length, 2);

    for (const draft of drafts) {
      assert.equal(draft.submitted_at, null);
      assert.deepEqual(
        draft.requested_days.map((d: { date: string }) => d.date),
        ["2099-07-11", "2099-07-13"],
      );
      assert.equal(
        draft.special_requests,
        draft.customer_id === null ? longNotes : "Quiet room\nBlue decor",
      );
      assert.equal(draft.budget, "PHP 50000");
      assert.equal(draft.requested_services[0].customName, "Acoustic duo");
      bookingDraftFieldsSchema.parse({
        requestedServices: draft.requested_services,
      });
    }

    const migratedMessage = (
      await pool.query("SELECT body FROM messages WHERE id=$1", [message])
    ).rows[0].body;

    for (const text of [
      "Anniversary",
      "2099-07-11",
      "Customer",
      "Acoustic duo",
      "Blue decor",
      "Dates are not reserved",
      "Please confirm",
    ])
      assert.ok(migratedMessage.includes(text), text);

    assert.equal(
      (await pool.query("SELECT count(*)::int AS n FROM booking_requests"))
        .rows[0].n,
      3,
    );
    await assert.rejects(
      pool.query(
        "INSERT INTO booking_requests(reference,submitted_at,out_of_range) VALUES('BAD',now(),false)",
      ),
      { code: "23514" },
    );
    await assert.rejects(
      pool.query(
        "UPDATE booking_requests SET duration_mode='invalid' WHERE id=$1",
        [old.id],
      ),
      { code: "23514" },
    );
    await assert.rejects(
      pool.query(
        "UPDATE booking_requests SET requested_services='{}'::jsonb WHERE id=$1",
        [old.id],
      ),
      { code: "23514" },
    );
    // Exercise the actual draft reader and customer API against this database.
    setTestConfig({ DB_NAME: name });
    ({ db: runtime } = await import("../src/db/client.js"));
    const { readBookingDraftData } =
      await import("../src/data/messages/booking-draft-guard.js");

    for (const id of [guestChat, customerChat]) {
      const draft = await readBookingDraftData(runtime, id);
      assert.equal(
        draft?.fields.requestedServices?.[0]?.customName,
        "Acoustic duo",
      );
    }

    const guestDraft = await readBookingDraftData(runtime, guestChat);
    assert.equal(guestDraft?.fields.specialRequests, longNotes);
    const customerMessage = (
      await pool.query(
        "INSERT INTO messages(conversation_id,sender_role,body,guest_origin) VALUES($1,'customer','Change event type',true) RETURNING id",
        [guestChat],
      )
    ).rows[0].id;
    const { startToolCallData } =
      await import("../src/data/ai/start-tool-call.js");
    const call = await startToolCallData(runtime, {
      turnId: randomUUID(),
      toolCallId: "migration-update",
      toolName: "updateBookingDraft",
      customerMessageId: customerMessage,
      input: {},
    });
    const { updateBookingDraftData } =
      await import("../src/data/messages/booking-draft-update.js");
    const updated = await updateBookingDraftData({
      db: runtime,
      callId: call.id,
      scope: {
        conversationId: guestChat,
        customerId: null,
        guestIdentityId: guest,
        customerMessageId: customerMessage,
        aiVersion: 0,
        expectedRevision: guestDraft?.revision ?? null,
      },
      patch: { eventType: "Birthday" },
    });
    assert.equal(updated.status, "updated");
    const saved = await readBookingDraftData(runtime, guestChat);
    assert.equal(saved?.fields.eventType, "Birthday");
    assert.equal(saved?.fields.specialRequests, longNotes);
    assert.ok(saved);
    const { resolveBookingDraft } =
      await import("../src/services/booking-requests/resolve-booking-draft.js");

    const resolution = await runtime
      .transaction()
      .execute((trx) => resolveBookingDraft(trx, saved.fields));

    assert.equal(resolution.createInput, null);
    assert.ok(resolution.missingFields.includes("specialRequests"));
    const correctionMessage = (
      await pool.query(
        "INSERT INTO messages(conversation_id,sender_role,body,guest_origin) VALUES($1,'customer','Shorten the notes',true) RETURNING id",
        [guestChat],
      )
    ).rows[0].id;
    const correctionCall = await startToolCallData(runtime, {
      turnId: randomUUID(),
      toolCallId: "migration-correction",
      toolName: "updateBookingDraft",
      customerMessageId: correctionMessage,
      input: {},
    });
    const corrected = await updateBookingDraftData({
      db: runtime,
      callId: correctionCall.id,
      scope: {
        conversationId: guestChat,
        customerId: null,
        guestIdentityId: guest,
        customerMessageId: correctionMessage,
        aiVersion: 0,
        expectedRevision: saved.revision,
      },
      patch: { specialRequests: "Shortened notes" },
    });
    assert.equal(corrected.status, "updated");
    const correctedDraft = await readBookingDraftData(runtime, guestChat);
    assert.ok(correctedDraft);

    const correctedResolution = await runtime
      .transaction()
      .execute((trx) => resolveBookingDraft(trx, correctedDraft.fields));

    assert.equal(
      correctedResolution.createInput?.specialRequests,
      "Shortened notes",
    );
    assert.equal(await readBookingDraftData(runtime, submittedChat), null);
    const token = randomUUID();
    const { hashSessionToken } = await import("../src/utils/session.js");
    await pool.query(
      "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [customer, hashSessionToken(token)],
    );
    const { app } = await import("../src/app.js");
    const response = await app.request("/v1/booking-requests/mine", {
      headers: { Cookie: `em_session=${token}` },
    });
    assert.equal(response.status, 200, await response.clone().text());
    const result = (await response.json()) as {
      bookingRequests: { id: string }[];
    };
    assert.deepEqual(
      result.bookingRequests.map((item) => item.id),
      [submitted.id],
    );
    const draftResponse = await app.request(
      `/v1/booking-requests/${byId.get(customerChat).booking_request_id}`,
      { headers: { Cookie: `em_session=${token}` } },
    );
    assert.equal(draftResponse.status, 404);
  } finally {
    await runtime?.destroy();

    if (previousDbName === undefined) setTestConfig({ DB_NAME: undefined });
    else setTestConfig({ DB_NAME: previousDbName });

    await pool?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
