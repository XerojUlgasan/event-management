import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { MockLanguageModelV4, MockProviderV4 } from "ai/test";
import {
  customerMessageResultSchema,
  threadSchema,
  conversationsSchema,
} from "../../src/controllers/messages/schemas.js";
import { hashSessionToken } from "../../src/utils/session.js";
import { runAssistantTurnService } from "../../src/services/ai/run-assistant-turn.js";

const database = `em_ai_test_${randomUUID().replaceAll("-", "")}`;
const modelId = "fixture/text-model";
let admin: Pool;
let pool: Pool;
let app: typeof import("../../src/app.js").app;
let db: typeof import("../../src/db/client.js").db;
let customer: { id: string; cookie: string };
let other: { id: string; cookie: string };
let team: { id: string; cookie: string };
let model: MockLanguageModelV4;
let packageId: string;

function useReply(text: string) {
  model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
  globalThis.AI_SDK_DEFAULT_PROVIDER = new MockProviderV4({
    languageModels: { [modelId]: model },
  });
}

before(async () => {
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const connection = {
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );
  }
  process.env.DB_NAME = database;
  process.env.AI_GATEWAY_API_KEY = "fixture-key";
  process.env.TEXT_MODEL = modelId;
  useReply("Hello from AMAC AI");
  ({ app } = await import("../../src/app.js"));
  ({ db } = await import("../../src/db/client.js"));
  async function session(role: "customer" | "admin") {
    const token = randomUUID();
    const user = await db
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
        user_id: user.id,
        token_hash: hashSessionToken(token),
        expires_at: new Date(Date.now() + 3600000),
      })
      .execute();
    return { id: user.id, cookie: `em_session=${token}` };
  }
  customer = await session("customer");
  other = await session("customer");
  team = await session("admin");
  packageId = (
    await db
      .insertInto("packages")
      .values({
        slug: `ai-context-${randomUUID()}`,
        name: "Private package marker",
        max_guests: 100,
        price: 1000,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
});

after(async () => {
  delete globalThis.AI_SDK_DEFAULT_PROVIDER;
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

function call(path: string, cookie: string, body?: unknown) {
  return app.request(`/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function conversation() {
  return (
    await db
      .insertInto("conversations")
      .values({ customer_id: customer.id })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}

async function send(conversationId: string, body: string) {
  const response = await call(
    "/messages/conversation/messages",
    customer.cookie,
    { conversationId, body },
  );
  assert.equal(response.status, 201);
  return customerMessageResultSchema.parse(await response.json());
}

function setAi(
  id: string,
  aiEnabled: unknown,
  expectedAiVersion: unknown,
  cookie = team.cookie,
) {
  return app.request(`/v1/admin/conversations/${id}/ai`, {
    method: "PATCH",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ aiEnabled, expectedAiVersion }),
  });
}

test("AI control is per conversation, authorized, versioned, and skips generation while off", async () => {
  useReply("AI is back");
  const id = await conversation();
  const otherId = await conversation();
  const initial = threadSchema.parse(
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
  );
  assert.equal(initial.conversation.aiEnabled, true);
  assert.equal(initial.conversation.aiVersion, 0);
  assert.equal((await setAi(id, false, 0, "")).status, 401);
  assert.equal((await setAi(id, false, 0, customer.cookie)).status, 403);
  assert.equal((await setAi(id, "false", 0)).status, 400);
  assert.equal((await setAi(id, false, -1)).status, 400);
  assert.equal((await setAi(randomUUID(), false, 0)).status, 404);

  const off = await setAi(id, false, 0);
  assert.equal(off.status, 200);
  assert.deepEqual(await off.json(), { aiEnabled: false, aiVersion: 1 });
  const noop = await setAi(id, false, 1);
  assert.equal(noop.status, 200);
  assert.deepEqual(await noop.json(), { aiEnabled: false, aiVersion: 1 });
  assert.equal((await setAi(id, true, 0)).status, 409);

  const held = await send(id, "A human can answer this");
  assert.equal(held.assistantMessage, null);
  assert.equal(held.assistantError, null);
  assert.equal(model.doGenerateCalls.length, 0);
  await db
    .updateTable("conversations")
    .set({ status: "closed", closed_at: new Date() })
    .where("id", "=", id)
    .execute();
  const reopened = await send(id, "Continue with the human team");
  assert.equal(reopened.assistantMessage, null);
  assert.equal(reopened.assistantError, null);
  assert.equal(model.doGenerateCalls.length, 0);
  const reopenedConversation = await db
    .selectFrom("conversations")
    .select(["status", "closed_at", "ai_enabled", "ai_version"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(reopenedConversation, {
    status: "active",
    closed_at: null,
    ai_enabled: false,
    ai_version: 1,
  });
  const otherThread = threadSchema.parse(
    await (await call(`/admin/conversations/${otherId}`, team.cookie)).json(),
  );
  assert.equal(otherThread.conversation.aiEnabled, true);
  assert.equal(otherThread.conversation.aiVersion, 0);

  const on = await setAi(id, true, 1);
  assert.equal(on.status, 200);
  assert.deepEqual(await on.json(), { aiEnabled: true, aiVersion: 2 });
  assert.equal(model.doGenerateCalls.length, 0);
  const answered = await send(id, "Now please answer");
  assert.equal(answered.assistantMessage?.body, "AI is back");
  assert.equal(answered.assistantError, null);
  assert.equal(model.doGenerateCalls.length, 1);

  await db
    .updateTable("conversations")
    .set({ status: "closed" })
    .where("id", "=", id)
    .execute();
  assert.equal((await setAi(id, false, 2)).status, 409);
});

test("simultaneous toggle requests with the same version cannot overwrite each other", async () => {
  const id = await conversation();
  const responses = await Promise.all([
    setAi(id, false, 0),
    setAi(id, false, 0),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  const thread = threadSchema.parse(
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
  );
  assert.equal(thread.conversation.aiEnabled, false);
  assert.equal(thread.conversation.aiVersion, 1);
});

test("admin takeover discards an in-flight AI reply even after AI is re-enabled", async () => {
  useReply("Old reply must not be saved");
  let started!: () => void;
  let release!: () => void;
  const generating = new Promise<void>((resolve) => {
    started = resolve;
  });
  const resume = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalGenerate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    started();
    await resume;
    return originalGenerate(...args);
  };
  const id = await conversation();
  const pending = send(id, "Question before takeover");
  await Promise.race([
    generating,
    pending.then(() => {
      throw new Error("Customer send completed before generation began");
    }),
  ]);
  try {
    const response = await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      {
        body: "A human is here",
      },
    );
    assert.equal(response.status, 201);
    const takeover = await response.json();
    assert.equal(takeover.aiEnabled, false);
    assert.equal(takeover.aiVersion, 1);
    const on = await setAi(id, true, 1);
    assert.equal(on.status, 200);
    assert.deepEqual(await on.json(), { aiEnabled: true, aiVersion: 2 });
  } finally {
    release();
  }
  const result = await pending;
  assert.equal(result.assistantMessage, null);
  assert.equal(result.assistantError, null);
  const thread = threadSchema.parse(
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
  );
  assert.deepEqual(
    thread.messages.map((message) => message.senderRole),
    ["customer", "admin"],
  );
  assert.equal(thread.conversation.aiEnabled, true);
  assert.equal(thread.conversation.aiVersion, 2);
});

function turnContext(callIndex: number) {
  const message = model.doGenerateCalls[callIndex].prompt[1];
  assert.equal(message.role, "user");
  assert.equal(message.content.length, 1);
  const part = message.content[0];
  assert.equal(part.type, "text");
  const context: unknown = JSON.parse(part.text);
  assert.ok(context && typeof context === "object");
  assert.ok("currentDateTime" in context);
  assert.ok(typeof context.currentDateTime === "string");
  const now = Date.parse(context.currentDateTime);
  assert.equal(new Date(now).toISOString(), context.currentDateTime);
  return { context, now };
}

async function booking(ownerId: string, reference: string) {
  return (
    await db
      .insertInto("booking_requests")
      .values({
        reference,
        customer_id: ownerId,
        package_id: packageId,
        event_type: "Wedding",
        preferred_date: "2099-01-01",
        requested_days: JSON.stringify([
          { date: "2099-01-01", startsAt: null, endsAt: null },
          { date: "2099-01-03", startsAt: null, endsAt: null },
        ]),
        time_zone: "Asia/Tokyo",
        guest_count: 75,
        contact_name: "Private contact marker",
        phone_number: "private-phone-marker",
        preferred_venue_location: "Garden",
        special_requests: "Outdoor setup",
        out_of_range: false,
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
}

test("general chat sends current time and null booking context without persisting it", async () => {
  useReply("General reply");
  const id = await conversation();
  const before = Date.now();
  await send(id, "General question");
  const after = Date.now();
  const { context, now } = turnContext(0);
  assert.ok(now >= before && now <= after);
  assert.deepEqual(context, {
    currentDateTime: new Date(now).toISOString(),
    timeZone: "Asia/Manila",
    bookingRequest: null,
  });
  const messages = await db
    .selectFrom("messages")
    .select(["body", "sender_role"])
    .where("conversation_id", "=", id)
    .orderBy("created_at")
    .execute();
  assert.deepEqual(messages, [
    { body: "General question", sender_role: "customer" },
    { body: "General reply", sender_role: "assistant" },
  ]);
});

test("linked booking context is projected, scoped, and refreshed for each turn", async () => {
  useReply("Booking reply");
  const reference = `AI-${randomUUID()}`;
  const bookingId = await booking(customer.id, reference);
  const otherBookingId = await booking(other.id, `PRIVATE-${randomUUID()}`);
  const id = (
    await db
      .insertInto("conversations")
      .values({ customer_id: customer.id, booking_request_id: bookingId })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  const scheduleId = randomUUID();
  await db
    .insertInto("events_day")
    .values({
      id: scheduleId,
      booking_request_id: bookingId,
      day: new Date("2099-01-01T00:00:00Z"),
      starts_at: new Date("2099-01-01T01:00:00Z"),
      ends_at: new Date("2099-01-01T04:00:00Z"),
    })
    .execute();
  await db
    .updateTable("booking_requests")
    .set({
      requested_days: JSON.stringify([
        {
          date: "2099-01-01",
          startsAt: "2099-01-01T00:00:00.000Z",
          endsAt: "2099-01-01T03:00:00.000Z",
          eventDayId: scheduleId,
        },
        { date: "2099-01-03", startsAt: null, endsAt: null },
      ]),
    })
    .where("id", "=", bookingId)
    .execute();
  const before = Date.now();
  await send(id, "Booking question");
  const after = Date.now();
  const first = turnContext(0);
  assert.ok(first.now >= before && first.now <= after);
  assert.deepEqual(first.context, {
    currentDateTime: new Date(first.now).toISOString(),
    timeZone: "Asia/Tokyo",
    bookingRequest: {
      reference,
      status: "under_review",
      eventType: "Wedding",
      guestCount: 75,
      timeZone: "Asia/Tokyo",
      requestedDays: [
        {
          date: "2099-01-01",
          startsAt: "2099-01-01T00:00:00.000Z",
          endsAt: "2099-01-01T03:00:00.000Z",
          operationalSchedule: {
            day: "2099-01-01",
            startsAt: "2099-01-01T01:00:00.000Z",
            endsAt: "2099-01-01T04:00:00.000Z",
            timeZone: "Asia/Tokyo",
            status: "scheduled",
          },
        },
        {
          date: "2099-01-03",
          startsAt: null,
          endsAt: null,
          operationalSchedule: null,
        },
      ],
      preferredVenueLocation: "Garden",
      specialRequests: "Outdoor setup",
    },
  });
  assert.doesNotMatch(
    JSON.stringify(first.context),
    new RegExp(
      `${bookingId}|${otherBookingId}|${scheduleId}|${packageId}|Private package marker|Private contact marker|private-phone-marker`,
    ),
  );
  await db
    .updateTable("booking_requests")
    .set({
      status: "needs_details",
      guest_count: 90,
      requested_days: null,
      starts_at: new Date("2099-01-01T02:00:00Z"),
      ends_at: new Date("2099-01-01T05:00:00Z"),
      special_requests: "Updated setup",
    })
    .where("id", "=", bookingId)
    .execute();
  await send(id, "Follow-up booking question");
  const second = turnContext(1);
  assert.deepEqual(second.context, {
    currentDateTime: new Date(second.now).toISOString(),
    timeZone: "Asia/Tokyo",
    bookingRequest: {
      reference,
      status: "needs_details",
      eventType: "Wedding",
      guestCount: 90,
      timeZone: "Asia/Tokyo",
      requestedDays: null,
      preferredDate: "2099-01-01",
      startsAt: "2099-01-01T02:00:00.000Z",
      endsAt: "2099-01-01T05:00:00.000Z",
      preferredVenueLocation: "Garden",
      specialRequests: "Updated setup",
    },
  });
  assert.match(
    JSON.stringify(model.doGenerateCalls[1].prompt.slice(2)),
    /Booking reply/,
  );
  const persisted = await db
    .selectFrom("messages")
    .select("body")
    .where("conversation_id", "=", id)
    .execute();
  assert.equal(persisted.length, 4);
  assert.ok(persisted.every(({ body }) => !body.includes(reference)));
});

test("a conversation linked to another customer's booking fails before generation", async () => {
  useReply("Should not run");
  const bookingId = await booking(other.id, `PRIVATE-${randomUUID()}`);
  const id = (
    await db
      .insertInto("conversations")
      .values({ customer_id: customer.id, booking_request_id: bookingId })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  const result = await send(id, "Question about this request");
  assert.equal(result.assistantMessage, null);
  assert.match(result.assistantError ?? "", /message was saved/);
  assert.equal(model.doGenerateCalls.length, 0);
});

test("customer sends generate persisted AI replies, visible after refresh with correct unread ownership", async () => {
  useReply("Hello from AMAC AI");
  const id = await conversation();
  const result = await send(id, "Hello");
  assert.equal(result.assistantError, null);
  assert.equal(result.message.senderRole, "customer");
  assert.equal(result.assistantMessage?.senderRole, "assistant");
  assert.equal(result.assistantMessage?.senderId, null);
  assert.equal(result.assistantMessage?.senderName, "AMAC AI");
  const list = conversationsSchema.parse(
    await (await call("/messages/conversations", customer.cookie)).json(),
  );
  const item = list.conversations.find((item) => item.id === id);
  assert.equal(item?.unreadCount, 1);
  assert.equal(item?.lastMessage?.id, result.assistantMessage?.id);
  const adminList = conversationsSchema.parse(
    await (await call("/admin/conversations", team.cookie)).json(),
  );
  assert.equal(
    adminList.conversations.find((item) => item.id === id)?.unreadCount,
    1,
  );
  const thread = threadSchema.parse(
    await (await call(`/messages/conversations/${id}`, customer.cookie)).json(),
  );
  assert.deepEqual(
    thread.messages.map((message) => message.senderRole),
    ["customer", "assistant"],
  );
  assert.ok(thread.messages[1].readAt);
  assert.equal(model.doGenerateCalls.length, 1);
});

test("model receives all ordered history beyond the UI page, including human team and AI replies, scoped to one conversation", async () => {
  useReply("Understood");
  const id = await conversation();
  const privateId = await conversation();
  await db
    .insertInto("messages")
    .values({
      conversation_id: privateId,
      sender_id: customer.id,
      sender_role: "customer",
      body: "unrelated-private-marker",
    })
    .execute();
  for (let i = 0; i < 22; i++) {
    await db
      .insertInto("messages")
      .values({
        conversation_id: id,
        sender_id: i === 21 ? null : i === 20 ? team.id : customer.id,
        sender_role: i === 21 ? "assistant" : i === 20 ? "admin" : "customer",
        body: `history-${i}`,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      })
      .execute();
  }
  const result = await send(id, "Latest question");
  assert.equal(result.assistantError, null);
  const prompt = model.doGenerateCalls[0].prompt;
  assert.equal(prompt.length, 25); // system + context + 22 stored messages + latest customer
  assert.equal(prompt[1].role, "user");
  assert.equal(prompt[22].role, "assistant");
  assert.equal(prompt[23].role, "assistant");
  assert.match(JSON.stringify(prompt[22]), /AMAC team: history-20/);
  assert.match(JSON.stringify(prompt.at(-1)), /Latest question/);
  assert.doesNotMatch(JSON.stringify(prompt), /unrelated-private-marker/);
  await send(id, "Follow-up");
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /Understood/);
});

test("provider failure, missing configuration, and empty output preserve the customer write without leaking errors", async () => {
  for (const failure of ["provider", "config", "empty"]) {
    useReply(failure === "empty" ? "   " : "unused");
    if (failure === "provider")
      model.doGenerate = async () => {
        throw new Error("private-provider-payload");
      };
    if (failure === "config") delete process.env.AI_GATEWAY_API_KEY;
    const id = await conversation();
    const result = await send(id, "Save this message");
    process.env.AI_GATEWAY_API_KEY = "fixture-key";
    assert.equal(result.assistantMessage, null);
    assert.match(result.assistantError ?? "", /message was saved/);
    assert.doesNotMatch(JSON.stringify(result), /private-provider-payload/);
    const messages = await db
      .selectFrom("messages")
      .select(["body", "sender_role"])
      .where("conversation_id", "=", id)
      .execute();
    assert.deepEqual(messages, [
      { body: "Save this message", sender_role: "customer" },
    ]);
  }
});

test("unauthorized/closed sends fail before generation, and admin messages do not trigger AI", async () => {
  useReply("Should not run");
  const id = await conversation();
  assert.equal(
    (
      await call("/messages/conversation/messages", other.cookie, {
        conversationId: id,
        body: "Not mine",
      })
    ).status,
    404,
  );
  await db
    .updateTable("conversations")
    .set({ status: "closed" })
    .where("id", "=", id)
    .execute();
  await assert.rejects(
    runAssistantTurnService({
      db,
      conversationId: id,
      customerId: customer.id,
      customerMessageId: randomUUID(),
      aiVersion: 0,
    }),
    /Conversation is closed/,
  );
  await db
    .updateTable("conversations")
    .set({ status: "active" })
    .where("id", "=", id)
    .execute();
  assert.equal(
    (
      await call(`/admin/conversations/${id}/messages`, team.cookie, {
        body: " ",
      })
    ).status,
    400,
  );
  const unchanged = threadSchema.parse(
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
  );
  assert.equal(unchanged.conversation.aiEnabled, true);
  assert.equal(unchanged.conversation.aiVersion, 0);
  assert.equal(
    (
      await call(`/admin/conversations/${id}/messages`, team.cookie, {
        body: "Human response",
      })
    ).status,
    201,
  );
  const afterTakeover = threadSchema.parse(
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
  );
  assert.equal(afterTakeover.conversation.aiEnabled, false);
  assert.equal(afterTakeover.conversation.aiVersion, 1);
  assert.equal(model.doGenerateCalls.length, 0);
});

test("assistant sender constraint accepts no human impersonation and keeps human identity required", async () => {
  const id = await conversation();
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id, sender_id, sender_role, body) VALUES ($1, $2, 'assistant', 'Invalid')",
      [id, customer.id],
    ),
    /messages_sender_role_matches_id_check/,
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO messages(conversation_id, sender_role, body) VALUES ($1, 'customer', 'Invalid')",
      [id],
    ),
    /messages_sender_role_matches_id_check/,
  );
});

test("cancelled generation and oversized history keep the saved customer message", async () => {
  useReply("Should not run");
  const id = await conversation();
  const trigger = await db
    .insertInto("messages")
    .values({
      conversation_id: id,
      sender_id: customer.id,
      sender_role: "customer",
      body: "Saved before cancellation",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const cancellation = new AbortController();
  cancellation.abort();
  await assert.rejects(
    runAssistantTurnService({
      db,
      customerId: customer.id,
      conversationId: id,
      customerMessageId: trigger.id,
      aiVersion: 0,
      abortSignal: cancellation.signal,
    }),
  );
  await db
    .updateTable("messages")
    .set({ body: "x".repeat(200_001) })
    .where("id", "=", trigger.id)
    .execute();
  await assert.rejects(
    runAssistantTurnService({
      db,
      customerId: customer.id,
      conversationId: id,
      customerMessageId: trigger.id,
      aiVersion: 0,
    }),
    /Conversation is too long/,
  );
  // History alone fits, but the per-turn context makes the full input too large.
  await db
    .updateTable("messages")
    .set({ body: "x".repeat(199_950) })
    .where("id", "=", trigger.id)
    .execute();
  await assert.rejects(
    runAssistantTurnService({
      db,
      customerId: customer.id,
      conversationId: id,
      customerMessageId: trigger.id,
      aiVersion: 0,
    }),
    /Conversation is too long/,
  );
  assert.equal(model.doGenerateCalls.length, 0);
  const saved = await db
    .selectFrom("messages")
    .select("sender_role")
    .where("conversation_id", "=", id)
    .execute();
  assert.deepEqual(saved, [{ sender_role: "customer" }]);
});

test("history snapshots stop at the triggering customer message and reject other customer scope", async () => {
  useReply("Snapshot reply");
  const id = await conversation();
  const trigger = await db
    .insertInto("messages")
    .values({
      conversation_id: id,
      sender_id: customer.id,
      sender_role: "customer",
      body: "first-turn-marker",
      created_at: new Date("2026-01-01T00:00:00Z"),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("messages")
    .values({
      conversation_id: id,
      sender_id: customer.id,
      sender_role: "customer",
      body: "later-turn-marker",
      created_at: new Date("2026-01-01T00:00:01Z"),
    })
    .execute();
  await assert.rejects(
    runAssistantTurnService({
      db,
      conversationId: id,
      customerId: other.id,
      customerMessageId: trigger.id,
      aiVersion: 0,
    }),
    /Conversation not found/,
  );
  await runAssistantTurnService({
    db,
    conversationId: id,
    customerId: customer.id,
    customerMessageId: trigger.id,
    aiVersion: 0,
  });
  assert.match(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /first-turn-marker/,
  );
  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /later-turn-marker/,
  );
});
