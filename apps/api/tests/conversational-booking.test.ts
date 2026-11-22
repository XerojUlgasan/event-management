import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import {
  reviewedServiceSchema,
  type BookingDraftPatch,
} from "@event-management/contracts/booking-draft";
import { sql } from "kysely";
import { Pool } from "pg";
import { startToolCallData } from "../src/data/ai/start-tool-call.js";
import { finishToolCallData } from "../src/data/ai/finish-tool-call.js";
import {
  readBookingDraftData,
  type BookingDraftScope,
} from "../src/data/messages/booking-draft-guard.js";
import { reviewBookingDraftData } from "../src/data/messages/booking-draft-review.js";
import {
  discardBookingDraftData,
  updateBookingDraftData,
} from "../src/data/messages/booking-draft-update.js";
import { submitReviewedBookingRequestService } from "../src/services/booking-requests/submit-reviewed-booking-request.js";
import { hashSessionToken } from "../src/utils/session.js";

const liveGatewayKey = process.env.AI_GATEWAY_API_KEY;

const database = `em_review_test_${randomUUID().replaceAll("-", "")}`;

const fields = {
  eventType: "Anniversary",
  durationMode: "multi_day",
  requestedDates: ["2099-07-11", "2099-07-13"],
  timeZone: "Asia/Manila",
  guestCount: 75,
  contactName: "Test Customer",
  phoneNumber: "123",
  specialRequests: "Quiet room",
  upsertServices: [{ customName: "Acoustic duo", hours: 2 }],
} satisfies BookingDraftPatch;

type Actor = { id: string; cookie: string };

let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let adminPool: Pool;
let pool: Pool;
let admin: Actor;
let secondAdmin: Actor;
let other: Actor;

before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  adminPool = new Pool({ ...connection, database: process.env.DB_NAME });
  await adminPool.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);

  for (const migration of (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    await pool.query(
      await readFile(new URL(`${migration}/migration.sql`, root), "utf8"),
    );
  }

  delete process.env.AI_GATEWAY_API_KEY;
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));
  admin = await session("admin");
  secondAdmin = await session("admin");
  other = await session("customer");
});

after(async () => {
  await db?.destroy();
  await pool?.end();

  if (adminPool) {
    await adminPool.query(`DROP DATABASE IF EXISTS "${database}"`);
    await adminPool.end();
  }
});

async function session(role: "customer" | "admin"): Promise<Actor> {
  const token = randomUUID();
  const { id } = await db
    .insertInto("users")
    .values({
      email: `${randomUUID()}@example.test`,
      role,
      password_hash: "unused",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("sessions")
    .values({
      user_id: id,
      token_hash: hashSessionToken(token),
      expires_at: new Date(Date.now() + 3600000),
    })
    .execute();

  return { id, cookie: `em_session=${token}` };
}

async function thread(customerId: string | null, guestIdentityId?: string) {
  return db
    .insertInto("conversations")
    .values({
      customer_id: customerId,
      guest_identity_id: guestIdentityId ?? null,
    })
    .returning(["id", "ai_version"])
    .executeTakeFirstOrThrow();
}

async function beginTurn(
  conversationId: string,
  customerId: string | null,
  body: string,
  guestIdentityId?: string,
) {
  const { id } = await db
    .insertInto("messages")
    .values({
      conversation_id: conversationId,
      sender_role: "customer",
      sender_id: customerId,
      guest_origin: !!guestIdentityId,
      body,
      created_at: sql<Date>`clock_timestamp()`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const conversation = await db
    .selectFrom("conversations")
    .select("ai_version")
    .where("id", "=", conversationId)
    .executeTakeFirstOrThrow();
  const draft = await readBookingDraftData(db, conversationId);

  return {
    conversationId,
    customerId,
    guestIdentityId,
    customerMessageId: id,
    aiVersion: conversation.ai_version,
    expectedRevision: draft?.revision ?? null,
  } satisfies BookingDraftScope;
}

async function toolCall(
  scope: BookingDraftScope,
  toolName: string,
  turnId = randomUUID(),
) {
  const { id } = await startToolCallData(db, {
    turnId,
    toolCallId: randomUUID(),
    customerMessageId: scope.customerMessageId,
    toolName,
    input: {},
  });

  return { db, scope, callId: id, turnId };
}

async function saveDraft(
  scope: BookingDraftScope,
  patch: BookingDraftPatch,
  turnId = randomUUID(),
) {
  const result = await updateBookingDraftData({
    ...(await toolCall(scope, "updateBookingDraft", turnId)),
    patch,
  });

  assert.ok(result.status === "updated" || result.status === "unchanged");
  scope.expectedRevision = result.revision;
}

async function review(scope: BookingDraftScope, turnId = randomUUID()) {
  const result = await reviewBookingDraftData(
    await toolCall(scope, "reviewBookingDraft", turnId),
  );

  assert.equal(result.status, "review_ready");

  if (result.status !== "review_ready") throw new Error("Review unavailable");

  return result.message;
}

async function confirm(
  scope: BookingDraftScope,
  reviewMessageId: string | null,
  intent: "submit" | "continue" | null = "submit",
) {
  const turnId = randomUUID();
  const draft = await readBookingDraftData(db, scope.conversationId);
  let consentAttemptId: string | null = null;

  if (draft && reviewMessageId && intent) {
    const attempt = await startToolCallData(db, {
      turnId,
      toolCallId: randomUUID(),
      customerMessageId: scope.customerMessageId,
      toolName: "assessBookingConsent",
      input: {
        reviewMessageId,
        bookingId: draft.id,
        revision: draft.revision,
        aiVersion: scope.aiVersion,
      },
    });
    await finishToolCallData(db, {
      id: attempt.id,
      status: "succeeded",
      output:
        intent === "submit"
          ? { intent, receiptCopy: { style: "en" } }
          : { intent },
    });
    consentAttemptId = attempt.id;
  }

  return submitReviewedBookingRequestService({
    ...(await toolCall(scope, "submitBookingRequest", turnId)),
    reviewMessageId,
    consentAttemptId,
  });
}

async function reviewedDraft(payload: BookingDraftPatch = fields) {
  const customer = await session("customer");
  const conversation = await thread(customer.id);
  const scope = await beginTurn(
    conversation.id,
    customer.id,
    "Review my request.",
  );
  const turnId = randomUUID();
  await saveDraft(scope, payload, turnId);
  const draft = await linkedBooking(conversation.id);
  const summary = await review(scope, turnId);

  return { customer, conversation, draft, summary };
}

async function call(
  path: string,
  actor?: Actor,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(actor ? { Cookie: actor.cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status: number) {
  assert.equal(response.status, status, await response.clone().text());

  return response.json();
}

function linkedBooking(conversationId: string) {
  return db
    .selectFrom("booking_requests")
    .selectAll()
    .where(
      "id",
      "=",
      db
        .selectFrom("conversations")
        .select("booking_request_id")
        .where("id", "=", conversationId),
    )
    .executeTakeFirstOrThrow();
}

function statusHistory(bookingId: string) {
  return db
    .selectFrom("booking_request_status_history")
    .select(["status", "changed_by"])
    .where("booking_request_id", "=", bookingId)
    .execute();
}

function notifications(bookingId: string) {
  return db
    .selectFrom("notifications")
    .select(["type", "recipient_user_id"])
    .where("source_event_id", "=", bookingId)
    .execute();
}

const { requestedDates } = fields;

const form = {
  eventType: fields.eventType,
  durationMode: fields.durationMode,
  requestedDays: requestedDates.map((date) => ({ date })),
  timeZone: fields.timeZone,
  contactName: "Form customer",
  phoneNumber: fields.phoneNumber,
  preferredVenueLocation: "Outdoor pavilion",
};

test("a partial request stays private, then an assessed chat confirmation promotes the same row", async () => {
  const customer = await session("customer");
  const conversation = await thread(customer.id);
  const firstTurn = await beginTurn(
    conversation.id,
    customer.id,
    "I need an event.",
  );
  await saveDraft(firstTurn, { eventType: fields.eventType });
  const partial = await linkedBooking(conversation.id);
  assert.equal(partial.event_type, fields.eventType);
  assert.equal(partial.customer_id, customer.id);
  assert.equal(partial.preferred_date, null);
  assert.equal(partial.submitted_at, null);
  assert.deepEqual(await statusHistory(partial.id), []);
  assert.deepEqual(await notifications(partial.id), []);

  for (const [prefix, actor] of [
    ["", customer],
    ["/admin", admin],
  ] as const)
    await read(
      await call(`${prefix}/booking-requests/${partial.id}`, actor),
      404,
    );

  const detail = await read(
    await call(`/messages/conversations/${conversation.id}`, customer),
    200,
  );
  assert.equal(detail.conversation.bookingRequestId, null);
  const mine = await read(await call("/booking-requests/mine", customer), 200);
  assert.deepEqual(mine.bookingRequests, []);

  const complete = await beginTurn(
    conversation.id,
    customer.id,
    "These are the rest of the details.",
  );
  const turnId = randomUUID();
  const longNotes = `Quiet room. ${"a".repeat(3950)} Blue decor at the end.`;
  const { upsertServices: extras, ...remaining } = fields;
  await saveDraft(
    complete,
    {
      ...remaining,
      specialRequests: longNotes,
      budget: "PHP 45,000",
      upsertServices: extras,
    },
    turnId,
  );
  const summary = await review(complete, turnId);

  for (const value of [
    "Test Customer",
    "123",
    "2099",
    "Asia/Manila",
    "PHP 45,000",
    "Acoustic duo",
    "2 hours",
    "Blue decor at the end",
    "Should I send this request to AMAC for review?",
  ])
    assert.ok(summary.body.includes(value), `Summary is missing ${value}`);

  const evidence = await db
    .selectFrom("ai_tool_calls")
    .select("output")
    .where("assistant_message_id", "=", summary.id)
    .where("tool_name", "=", "reviewBookingDraft")
    .executeTakeFirstOrThrow();
  assert.deepEqual(Object.keys(evidence.output as object).sort(), [
    "aiVersion",
    "bookingId",
    "catalogFingerprint",
    "revision",
    "status",
  ]);

  const approval = await beginTurn(
    conversation.id,
    customer.id,
    "  OO, ISUMITE! ",
  );
  const result = await confirm(approval, summary.id);
  assert.equal(result.status, "submitted");

  if (result.status !== "submitted") return;

  const submitted = await linkedBooking(conversation.id);
  assert.equal(submitted.id, partial.id);
  assert.equal(submitted.reference, partial.reference);
  assert.equal(submitted.status, "under_review");
  assert.ok(submitted.submitted_at);
  assert.equal(submitted.budget, "PHP 45,000");
  assert.equal(submitted.special_requests, longNotes);
  assert.equal(submitted.duration_mode, "multi_day");
  const requestedServices = reviewedServiceSchema
    .array()
    .parse(submitted.requested_services);
  assert.ok(requestedServices[0].id);
  assert.deepEqual(
    requestedServices.map(({ id: _id, ...service }) => service),
    [
      {
        serviceId: null,
        name: "Acoustic duo",
        hours: 2,
        notes: null,
        included: false,
        updatedAt: null,
      },
    ],
  );
  assert.equal(result.message.reply_to_message_id, approval.customerMessageId);
  assert.match(result.message.body, new RegExp(submitted.reference));
  assert.equal(await readBookingDraftData(db, conversation.id), null);
  assert.deepEqual(await statusHistory(submitted.id), [
    { status: "under_review", changed_by: customer.id },
  ]);
  assert.deepEqual(
    (await notifications(submitted.id))
      .map((notice) => notice.recipient_user_id)
      .sort(),
    [admin.id, secondAdmin.id].sort(),
  );

  for (const [prefix, actor] of [
    ["", customer],
    ["/admin", admin],
  ] as const) {
    const body = await read(
      await call(`${prefix}/booking-requests/${submitted.id}`, actor),
      200,
    );
    assert.equal(body.bookingRequest.budget, submitted.budget);
    assert.deepEqual(
      body.bookingRequest.requestedServices,
      submitted.requested_services,
    );
  }
});

test("a slow answer to an earlier message cannot displace the current booking summary", async () => {
  const customer = await session("customer");
  const chat = await thread(customer.id);
  const older = await beginTurn(
    chat.id,
    customer.id,
    "What services are available?",
  );
  const newer = await beginTurn(
    chat.id,
    customer.id,
    "Here are my booking details.",
  );
  await saveDraft(newer, fields);
  const summary = await review(newer);
  const { createAssistantMessageData } =
    await import("../src/data/messages/create-assistant-message.js");
  const late = await createAssistantMessageData(
    db,
    chat.id,
    customer.id,
    "Earlier catalog answer",
    older.aiVersion,
    undefined,
    {
      turnId: randomUUID(),
      customerMessageId: older.customerMessageId,
    },
  );
  assert.equal(late, null);
  const consent = await beginTurn(chat.id, customer.id, "Yes, submit");
  assert.equal((await confirm(consent, summary.id)).status, "submitted");
});

test("a correction, unknown target, ordinary message, or attachment cannot submit", async () => {
  for (const attempt of [
    "correction",
    "unknown",
    "ordinary",
    "attachment",
  ] as const) {
    const { conversation, customer, summary, draft } = await reviewedDraft({
      eventType: fields.eventType,
      durationMode: fields.durationMode,
      requestedDates,
      timeZone: fields.timeZone,
      contactName: fields.contactName,
      phoneNumber: fields.phoneNumber,
    });
    let target = summary.id;

    if (attempt === "ordinary") {
      const ordinary = await db
        .insertInto("messages")
        .values({
          conversation_id: conversation.id,
          sender_role: "assistant",
          body: summary.body,
          created_at: sql<Date>`clock_timestamp()`,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      target = ordinary.id;
    } else if (attempt === "unknown") {
      target = randomUUID();
    }

    const approval = await beginTurn(
      conversation.id,
      customer.id,
      attempt === "correction"
        ? "Yes, submit after changing the date."
        : "Yes, submit",
    );

    if (attempt === "attachment")
      await db
        .insertInto("message_images")
        .values({
          message_id: approval.customerMessageId,
          position: 0,
          storage_key: randomUUID(),
          mime_type: "image/png",
          byte_size: 10,
          content_hash: "a".repeat(64),
        })
        .execute();

    const result = await confirm(
      approval,
      target,
      attempt === "correction" ? "continue" : "submit",
    );
    assert.equal(
      result.status,
      attempt === "correction" || attempt === "attachment"
        ? "confirmation_required"
        : "review_changed",
    );
    assert.deepEqual(await linkedBooking(conversation.id), draft);
    assert.deepEqual(await notifications(draft.id), []);
  }
});

test("changed catalog, draft, AI version, and intervening turns invalidate earlier summaries", async () => {
  const pkg = await db
    .insertInto("packages")
    .values({
      slug: "review-package",
      name: "Event Package",
      max_guests: 100,
      price: 10000,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const service = await db
    .insertInto("services")
    .values({
      slug: "review-service",
      name: "Event Service",
      description: "A listed service",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  for (const change of [
    "package",
    "service",
    "fields",
    "ai",
    "turn",
  ] as const) {
    const initial = await reviewedDraft({
      ...fields,
      ...(change === "package" ? { packageId: pkg.id } : {}),
      ...(change === "service"
        ? { upsertServices: [{ serviceId: service.id }] }
        : {}),
    });
    const { conversation, customer, summary } = initial;

    if (change === "package")
      await db
        .updateTable("packages")
        .set({ price: 10001 })
        .where("id", "=", pkg.id)
        .execute();

    if (change === "service")
      await db
        .updateTable("services")
        .set({ archived_at: new Date() })
        .where("id", "=", service.id)
        .execute();

    if (change === "ai") {
      for (const [aiEnabled, expectedAiVersion] of [
        [false, conversation.ai_version],
        [true, conversation.ai_version + 1],
      ] as const)
        await read(
          await call(
            `/admin/conversations/${conversation.id}/ai`,
            admin,
            { aiEnabled, expectedAiVersion },
            "PATCH",
          ),
          200,
        );
    }

    if (change === "turn")
      await beginTurn(conversation.id, customer.id, "Please hold off.");

    const approval = await beginTurn(
      conversation.id,
      customer.id,
      "Yes, submit",
    );

    if (change === "fields") await saveDraft(approval, { guestCount: 82 });

    const before = await linkedBooking(conversation.id);
    const result = await confirm(approval, summary.id);
    assert.equal(result.status, "review_changed", change);
    assert.deepEqual(await linkedBooking(conversation.id), before);
    assert.deepEqual(await notifications(initial.draft.id), []);
  }
});

test("an unavailable package choice preserves the old choice and saves unrelated corrections", async () => {
  const pkg = await db
    .insertInto("packages")
    .values({
      slug: "previous-choice",
      name: "Previous Choice",
      max_guests: 100,
      price: 10000,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const { customer, conversation, draft } = await reviewedDraft({
    ...fields,
    packageId: pkg.id,
  });
  const scope = await beginTurn(
    conversation.id,
    customer.id,
    "Change the package and add 30 guests.",
  );
  const result = await updateBookingDraftData({
    ...(await toolCall(scope, "updateBookingDraft")),
    patch: { packageId: randomUUID(), guestCount: 105 },
  });
  assert.equal(result.status, "updated");
  assert.deepEqual(result.status === "updated" && result.invalidSelections, [
    "packageId",
  ]);
  const saved = await linkedBooking(conversation.id);
  assert.equal(saved.id, draft.id);
  assert.equal(saved.guest_count, 105);
  assert.equal(saved.package_id, pkg.id);
  assert.equal(saved.out_of_range, true);
});

test("guest claim transfers the existing row, and requires a new signed-in summary", async () => {
  const token = randomUUID();
  const guest = await db
    .insertInto("guest_chat_identities")
    .values({ token_hash: hashSessionToken(token) })
    .returning("id")
    .executeTakeFirstOrThrow();
  const conversation = await thread(null, guest.id);
  const scope = await beginTurn(
    conversation.id,
    null,
    "These are my event details.",
    guest.id,
  );
  const turnId = randomUUID();
  await saveDraft(scope, fields, turnId);
  const draft = await linkedBooking(conversation.id);
  assert.equal(draft.customer_id, null);
  const anonymousSummary = await review(scope, turnId);
  assert.match(anonymousSummary.body, /Sign in/);
  const guestConsent = await beginTurn(
    conversation.id,
    null,
    "Yes, submit",
    guest.id,
  );
  assert.equal(
    (await confirm(guestConsent, anonymousSummary.id)).status,
    "sign_in_required",
  );

  const customer = await session("customer");
  const claimPath = `/guest/conversations/${conversation.id}/claim`;

  const withGuest = (actor: Actor) => ({
    ...actor,
    cookie: `${actor.cookie}; em_guest=${token}`,
  });

  await read(await call(claimPath, admin, {}), 403);
  await read(await call(claimPath, customer, {}), 404);
  await read(await call(claimPath, withGuest(customer), {}), 200);
  await read(await call(claimPath, withGuest(customer), {}), 200);
  await read(await call(claimPath, withGuest(other), {}), 404);
  const claimed = await linkedBooking(conversation.id);
  assert.equal(claimed.id, draft.id);
  assert.equal(claimed.customer_id, customer.id);
  assert.equal(claimed.submitted_at, null);
  await assert.rejects(
    confirm(guestConsent, anonymousSummary.id),
    /Draft turn is no longer active/,
  );

  const signedInConsent = await beginTurn(
    conversation.id,
    customer.id,
    "Yes, submit",
  );
  assert.equal(
    (await confirm(signedInConsent, anonymousSummary.id)).status,
    "review_changed",
  );
  const resumed = await beginTurn(conversation.id, customer.id, "Continue.");
  const signedInSummary = await review(resumed);
  const confirmed = await beginTurn(
    conversation.id,
    customer.id,
    "Yes, submit",
  );
  assert.equal(
    (await confirm(confirmed, signedInSummary.id)).status,
    "submitted",
  );
  assert.equal((await linkedBooking(conversation.id)).id, draft.id);
});

test("receipt write failure rolls promotion and side effects back, and the saved turn can retry", async () => {
  const { customer, conversation, summary, draft } = await reviewedDraft();
  const scope = await beginTurn(conversation.id, customer.id, "Yes, submit");
  await pool.query(`CREATE FUNCTION fail_booking_receipt() RETURNS trigger LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'injected submission error'; END $$`);
  await pool.query(`CREATE TRIGGER fail_booking_receipt BEFORE INSERT ON messages
    FOR EACH ROW WHEN (NEW.sender_role = 'assistant') EXECUTE FUNCTION fail_booking_receipt()`);

  try {
    await assert.rejects(
      confirm(scope, summary.id),
      /injected submission error/,
    );
    assert.deepEqual(await linkedBooking(conversation.id), draft);
    assert.deepEqual(await statusHistory(draft.id), []);
    assert.deepEqual(await notifications(draft.id), []);
  } finally {
    await pool.query("DROP TRIGGER fail_booking_receipt ON messages");
    await pool.query("DROP FUNCTION fail_booking_receipt()");
  }

  assert.equal((await confirm(scope, summary.id)).status, "submitted");
  assert.equal((await statusHistory(draft.id)).length, 1);
});

test("duplicate submission and a competing form promote the linked draft at most once", async () => {
  const first = await reviewedDraft();
  const firstApproval = await beginTurn(
    first.conversation.id,
    first.customer.id,
    "Yes, submit",
  );
  const twice = await Promise.allSettled([
    confirm(firstApproval, first.summary.id),
    confirm(firstApproval, first.summary.id),
  ]);
  assert.equal(
    twice.filter(
      (result) =>
        result.status === "fulfilled" && result.value.status === "submitted",
    ).length,
    1,
  );
  assert.equal((await statusHistory(first.draft.id)).length, 1);
  assert.equal((await notifications(first.draft.id)).length, 2);
  assert.equal((await linkedBooking(first.conversation.id)).id, first.draft.id);

  const second = await reviewedDraft({ ...fields, budget: "PHP 7,000" });
  const secondApproval = await beginTurn(
    second.conversation.id,
    second.customer.id,
    "Yes, submit",
  );
  const [fromChat, fromForm] = await Promise.all([
    confirm(secondApproval, second.summary.id),
    call("/booking-requests", second.customer, {
      ...form,
      conversationId: second.conversation.id,
    }),
  ]);
  const booking = await linkedBooking(second.conversation.id);
  assert.equal(booking.id, second.draft.id);
  assert.ok(booking.submitted_at);
  assert.equal((await statusHistory(booking.id)).length, 1);
  assert.equal((await notifications(booking.id)).length, 2);

  if (fromForm.status === 201) {
    assert.equal(fromChat.status, "review_changed");
    assert.equal(booking.budget, null);
    assert.equal(booking.requested_services, null);
    assert.equal(booking.contact_name, form.contactName);
  } else {
    await read(fromForm, 409);
    assert.equal(fromChat.status, "submitted");
    assert.equal(booking.budget, "PHP 7,000");
    assert.equal(booking.contact_name, fields.contactName);
  }
});

test("form promotion uses the form values and clears discarded draft-only details", async () => {
  const { customer, conversation, draft, summary } = await reviewedDraft({
    ...fields,
    budget: "PHP 7,000",
  });
  const created = await read(
    await call("/booking-requests", customer, {
      ...form,
      conversationId: conversation.id,
    }),
    201,
  );
  assert.equal(created.bookingRequest.id, draft.id);
  assert.equal(created.bookingRequest.reference, draft.reference);
  assert.equal(
    created.bookingRequest.preferredVenueLocation,
    form.preferredVenueLocation,
  );
  assert.equal(created.bookingRequest.budget, null);
  assert.equal(created.bookingRequest.specialRequests, null);
  assert.deepEqual(created.bookingRequest.requestedServices, []);

  const scope = await beginTurn(conversation.id, customer.id, "Yes, submit");
  assert.equal((await confirm(scope, summary.id)).status, "review_changed");
  assert.equal((await statusHistory(draft.id)).length, 1);
});

test("explicit discard unlinks and removes the unsubmitted row, invalidating the old summary", async () => {
  const { customer, conversation, draft, summary } = await reviewedDraft();
  const scope = await beginTurn(
    conversation.id,
    customer.id,
    "Discard the draft.",
  );
  const discarded = await discardBookingDraftData(
    await toolCall(scope, "updateBookingDraft"),
  );
  assert.equal(discarded.status, "discarded");
  assert.equal(await readBookingDraftData(db, conversation.id), null);
  assert.equal(
    await db
      .selectFrom("booking_requests")
      .select("id")
      .where("id", "=", draft.id)
      .executeTakeFirst(),
    undefined,
  );
  const approval = await beginTurn(conversation.id, customer.id, "Yes, submit");
  assert.equal((await confirm(approval, summary.id)).status, "review_changed");
});

test(
  "configured AMAC model recommends a package and submits its reviewed draft",
  { skip: process.env.AMAC_LIVE_TOOL_TESTS !== "1" },
  async () => {
    assert.ok(
      liveGatewayKey && process.env.TEXT_MODEL,
      "Configure the Gateway model for this opt-in test",
    );
    process.env.AI_GATEWAY_API_KEY = liveGatewayKey;

    try {
      const pkg = await db
        .insertInto("packages")
        .values({
          name: "Celebration Garden",
          slug: "celebration-garden",
          max_guests: 80,
          price: 18000,
          description: "A garden-themed event package.",
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const actor = await session("customer");
      const conversation = await thread(actor.id);
      async function send(body: string, reviewMessageId?: string) {
        return read(
          await call("/messages/conversation/messages", actor, {
            conversationId: conversation.id,
            requestId: randomUUID(),
            body,
            reviewMessageId,
          }),
          201,
        );
      }

      const options = await send(
        "Which of your packages fits 70 guests and a package budget of up to PHP 20,000?",
      );
      assert.equal(options.assistantError, null);
      assert.match(options.assistantMessage.body, /Celebration Garden/i);
      assert.doesNotMatch(
        options.assistantMessage.body,
        /(?:minimum|at least) (?:of )?80 (?:guests|pax)/i,
      );

      const review = await send(
        "I want to book that Celebration Garden package for a birthday, one day on 11 July 2099 in Asia/Manila, 70 guests. The contact person is Sample Customer and the phone is 09000000000. Please note a custom request for a bilingual host. Those are all my details.",
      );
      assert.equal(review.assistantError, null);

      for (const value of [
        /Celebration Garden/i,
        /bilingual/i,
        /20(?:,?000|k)\b/i,
      ])
        assert.match(review.assistantMessage.body, value);

      const draft = await linkedBooking(conversation.id);
      assert.equal(draft.package_id, pkg.id);
      assert.equal(draft.submitted_at, null);

      const result = await send("Yes, submit", review.assistantMessage.id);
      assert.match(result.assistantMessage.body, /submitted for AMAC review/);
      const submitted = await linkedBooking(conversation.id);
      assert.equal(submitted.id, draft.id);
      assert.ok(submitted.submitted_at);
      assert.equal(submitted.budget, draft.budget);
      assert.match(JSON.stringify(submitted.requested_services), /bilingual/i);
    } finally {
      delete process.env.AI_GATEWAY_API_KEY;
    }
  },
);
