import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { sql } from "kysely";
import { hashSessionToken } from "../src/utils/session.js";

const database = `em_messages_test_${randomUUID().replaceAll("-", "")}`;
let app: typeof import("../src/app.js").app;
let db: typeof import("../src/db/client.js").db;
let admin: Pool;
let pool: Pool;
let adminCookie: string;
let customerCookie: string;
let otherCustomerCookie: string;
let customerId: string;
let otherCustomerId: string;
let chatCustomerCookie: string;
let chatCustomerId: string;
let packageId: string;

before(async () => {
  assert.ok(
    ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST ?? "localhost"),
    "Tests require local PostgreSQL",
  );
  const connection = {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  admin = new Pool({ ...connection, database: process.env.DB_NAME });
  await admin.query(`CREATE DATABASE "${database}"`);
  pool = new Pool({ ...connection, database });
  const root = new URL("../prisma/migrations/", import.meta.url);
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
  }
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));

  async function session(role: string, name: string) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({ email: `${role}-${randomUUID()}@example.test`, display_name: name, password_hash: "unused", role, staff_role: role === "admin" ? "System Administrator" : null })
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
    return { cookie: `em_session=${token}`, id: user.id };
  }

  ({ cookie: adminCookie } = await session("admin", "Admin Person"));
  const customer = await session("customer", "Customer One");
  customerCookie = customer.cookie;
  customerId = customer.id;
  const other = await session("customer", "Customer Two");
  otherCustomerCookie = other.cookie;
  otherCustomerId = other.id;
  const chatCustomer = await session("customer", "Chat Customer");
  chatCustomerCookie = chatCustomer.cookie;
  chatCustomerId = chatCustomer.id;

  const pkg = await sql<{ id: string }>`INSERT INTO "packages" DEFAULT VALUES RETURNING "id"`
    .execute(db)
    .then((result) => result.rows[0]);
  packageId = pkg.id;
  await db
    .insertInto("package_versions")
    .values({
      package_id: packageId,
      version: 1,
      state: "published",
      name: "Garden Wedding",
      event_types: ["Wedding"],
      description: "A garden wedding package",
      guest_min: 50,
      guest_max: 100,
      venue_details: "Garden venue",
      inclusions: ["Buffet dinner"],
      exclusions: ["Drinks"],
      terms: "50% deposit",
      price_amount_minor: 15_000_000,
      published_at: new Date(),
    })
    .execute();
});

after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
});

function call(path: string, method = "GET", body?: unknown, cookie?: string) {
  return app.request(`/v1${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function read(response: Response, status: number): Promise<any> {
  assert.equal(response.status, status, await response.clone().text());
  return response.status === 204 ? null : response.json();
}

test("customer and staff conversations enforce roles and validate messages", async () => {
  await read(await call("/messages/conversation"), 401);
  await read(await call("/admin/conversations"), 401);
  await read(await call("/messages/conversation", "GET", undefined, adminCookie), 403);
  await read(await call("/admin/conversations", "GET", undefined, customerCookie), 403);
  await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);

  const empty = await read(await call("/messages/conversation", "GET", undefined, customerCookie), 200);
  assert.equal(empty.messages.length, 0);
  assert.equal(empty.conversation.customerId, customerId);
  assert.equal(empty.conversation.customerName, "Customer One");
  assert.equal(empty.conversation.unreadCount, 0);
  const again = await read(await call("/messages/conversation", "GET", undefined, customerCookie), 200);
  assert.equal(again.conversation.id, empty.conversation.id);

  await read(await call("/messages/conversation/messages", "POST", { body: "   " }, customerCookie), 400);
  await read(await call("/messages/conversation/messages", "POST", { body: "x".repeat(4001) }, customerCookie), 400);
  await read(await call("/messages/conversation/messages", "POST", { body: "No session" }), 401);
  await read(await call("/messages/conversation/messages", "POST", { body: "Admin cannot use customer route" }, adminCookie), 403);

  const sent = await read(
    await call("/messages/conversation/messages", "POST", { body: "  Hello team  " }, customerCookie),
    201,
  );
  assert.equal(sent.message.body, "Hello team");
  assert.equal(sent.message.senderRole, "customer");
  assert.equal(sent.message.senderId, customerId);
  assert.equal(sent.message.senderName, "Customer One");
  assert.equal(sent.message.readAt, null);

  const list = await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);
  assert.equal(list.conversations.length, 1);
  assert.equal(list.conversations[0].id, empty.conversation.id);
  assert.equal(list.conversations[0].unreadCount, 1);
  assert.equal(list.conversations[0].lastMessage.body, "Hello team");

  const thread = await read(
    await call(`/admin/conversations/${empty.conversation.id}`, "GET", undefined, adminCookie),
    200,
  );
  assert.equal(thread.messages.length, 1);
  assert.ok(thread.messages[0].readAt);
  assert.equal(thread.conversation.unreadCount, 0);
  assert.equal(
    (await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200)).conversations[0]
      .unreadCount,
    0,
  );

  const reply = await read(
    await call(`/admin/conversations/${empty.conversation.id}/messages`, "POST", { body: " We can help " }, adminCookie),
    201,
  );
  assert.equal(reply.message.body, "We can help");
  assert.equal(reply.message.senderRole, "admin");
  assert.equal(reply.message.senderName, "Admin Person");
  assert.equal(reply.message.readAt, null);

  const customerThread = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );
  assert.deepEqual(
    customerThread.messages.map((message: any) => message.body).sort(),
    ["Hello team", "We can help"],
  );
  assert.ok(customerThread.messages.find((message: any) => message.senderRole === "admin").readAt);

  await read(
    await call("/messages/conversation/messages", "POST", { body: "One more question" }, customerCookie),
    201,
  );
  const unread = await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);
  assert.equal(unread.conversations[0].unreadCount, 1);
  assert.equal(unread.conversations[0].lastMessage.body, "One more question");
});

test("conversations are isolated per customer and unknown ids return 404", async () => {
  const other = await read(await call("/messages/conversation", "GET", undefined, otherCustomerCookie), 200);
  assert.equal(other.conversation.customerId, otherCustomerId);
  assert.equal(other.messages.length, 0);

  await read(
    await call("/messages/conversation/messages", "POST", { body: "Second customer here" }, otherCustomerCookie),
    201,
  );

  const list = await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);
  assert.equal(list.conversations.length, 2);
  assert.equal(list.conversations.filter((item: any) => item.unreadCount === 1).length, 2);

  const mine = await read(await call("/messages/conversation", "GET", undefined, customerCookie), 200);
  assert.ok(mine.messages.every((message: any) => message.body !== "Second customer here"));

  await read(
    await call(`/admin/conversations/${randomUUID()}`, "GET", undefined, adminCookie),
    404,
  );
  await read(
    await call(`/admin/conversations/${randomUUID()}/messages`, "POST", { body: "hello" }, adminCookie),
    404,
  );
});

test("customers can start a separate conversation without losing the previous one", async () => {
  const previous = await read(await call("/messages/conversation", "GET", undefined, otherCustomerCookie), 200);
  const created = await read(await call("/messages/conversations", "POST", {}, otherCustomerCookie), 201);
  assert.notEqual(created.conversation.id, previous.conversation.id);
  assert.equal(created.messages.length, 0);
  const current = await read(await call("/messages/conversation", "GET", undefined, otherCustomerCookie), 200);
  assert.equal(current.conversation.id, created.conversation.id);
  assert.equal(current.messages.length, 0);
  const old = await read(
    await call(`/admin/conversations/${previous.conversation.id}`, "GET", undefined, adminCookie),
    200,
  );
  assert.ok(old.messages.some((message: any) => message.body === "Second customer here"));
});

async function withGeminiMock<T>(run: (calls: Array<{ url: string; init: RequestInit }>) => Promise<T>) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "gemini-test";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "Mocked reply" }] } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  }
}

test("guest chatbot validates input and answers from approved package records", async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const unavailable = await read(
    await call("/chatbot/guest-reply", "POST", { messages: [{ role: "user", body: "Hi" }] }),
    503,
  );
  assert.match(unavailable.error, /assistant is unavailable right now/i);
  if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;

  await read(
    await call("/chatbot/guest-reply", "POST", {
      messages: [
        { role: "user", body: "Hi" },
        { role: "assistant", body: "Hello" },
      ],
    }),
    400,
  );

  await withGeminiMock(async (calls) => {
    const result = await read(
      await call("/chatbot/guest-reply", "POST", {
        messages: [
          { role: "assistant", body: "Hello" },
          { role: "user", body: "What is in the garden wedding package?" },
        ],
        context: { packageId },
      }),
      200,
    );
    assert.equal(result.reply, "Mocked reply");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /gemini-test:generateContent/);
    assert.equal((calls[0].init.headers as Record<string, string>)["x-goog-api-key"], "test-key");
    const payload = JSON.parse(String(calls[0].init.body));
    const prompt = payload.systemInstruction.parts[0].text;
    assert.match(prompt, /Garden Wedding/);
    assert.match(prompt, /PHP 150,000\.00/);
    assert.match(prompt, /never invent/i);
    assert.equal(payload.contents.at(-1).role, "user");
    assert.match(payload.contents.at(-1).parts[0].text, /garden wedding package/i);
  });
});

test("guest history is claimed once into the signed-in customer conversation", async () => {
  const packageVersion = await db
    .selectFrom("package_versions")
    .select("id")
    .where("package_id", "=", packageId)
    .executeTakeFirstOrThrow();
  const booking = await db
    .insertInto("booking_requests")
    .values({
      reference: `BR-TEST-${randomUUID()}`,
      customer_id: chatCustomerId,
      package_id: packageId,
      package_version_id: packageVersion.id,
      package_name: "Garden Wedding",
      event_type: "Wedding",
      starts_at: new Date(Date.now() + 86_400_000),
      ends_at: new Date(Date.now() + 90_000_000),
      time_zone: "Asia/Manila",
      guest_count: 80,
      contact_name: "Chat Customer",
      phone_number: "123",
      preferred_venue_location: "Manila",
      special_requests: null,
      status: "under_review",
      out_of_range: false,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const bound = await db
    .insertInto("conversations")
    .values({
      customer_id: chatCustomerId,
      booking_request_id: booking.id,
      package_id: packageId,
      event_type: "Wedding",
      event_starts_at: new Date(Date.now() + 86_400_000),
      event_ends_at: new Date(Date.now() + 90_000_000),
      guest_count: 80,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const claim = {
    guestChatId: "guest-chat-import-1",
    messages: [
      { role: "assistant", body: "Welcome to Clemora" },
      { role: "user", body: "I want a garden wedding" },
      { role: "assistant", body: "Great choice" },
    ],
    context: { packageId, eventType: "Wedding" },
  };
  const first = await read(
    await call("/messages/conversation/claim", "POST", claim, chatCustomerCookie),
    200,
  );
  assert.equal(first.conversation.customerId, chatCustomerId);
  assert.equal(first.conversation.packageId, packageId);
  assert.equal(first.conversation.packageName, "Garden Wedding");
  assert.equal(first.conversation.eventType, "Wedding");
  assert.equal(first.conversation.status, "active");
  assert.notEqual(first.conversation.id, bound.id);
  assert.equal(first.conversation.bookingRequestId, null);
  assert.deepEqual(
    first.messages.map((message: any) => message.senderRole),
    ["assistant", "customer", "assistant"],
  );
  assert.equal(first.messages[1].senderId, chatCustomerId);
  assert.equal(first.messages[0].senderId, null);

  const again = await read(
    await call("/messages/conversation/claim", "POST", claim, chatCustomerCookie),
    200,
  );
  assert.equal(again.messages.length, 3);

  await read(
    await call(
      "/messages/conversation/claim",
      "POST",
      { ...claim, guestChatId: "guest-chat-import-2", context: { packageId: randomUUID() } },
      chatCustomerCookie,
    ),
    400,
  );
});

test("conversation context, staff handoff, and takeover gate assistant replies", async () => {
  const now = Date.now();
  await read(
    await call(
      "/messages/conversation/context",
      "PATCH",
      {
        eventStartsAt: new Date(now + 86_400_000).toISOString(),
        eventEndsAt: new Date(now).toISOString(),
      },
      chatCustomerCookie,
    ),
    400,
  );
  await read(
    await call("/messages/conversation/context", "PATCH", { packageId: randomUUID() }, chatCustomerCookie),
    400,
  );

  // A partial update cannot move the end before an existing start.
  await read(
    await call(
      "/messages/conversation/context",
      "PATCH",
      { eventStartsAt: new Date(now + 10 * 86_400_000).toISOString() },
      chatCustomerCookie,
    ),
    200,
  );
  await read(
    await call(
      "/messages/conversation/context",
      "PATCH",
      { eventEndsAt: new Date(now + 5 * 86_400_000).toISOString() },
      chatCustomerCookie,
    ),
    400,
  );
  await read(
    await call(
      "/messages/conversation/context",
      "PATCH",
      {
        eventStartsAt: null,
        eventEndsAt: new Date(now + 7 * 86_400_000).toISOString(),
      },
      chatCustomerCookie,
    ),
    200,
  );

  const updated = await read(
    await call(
      "/messages/conversation/context",
      "PATCH",
      {
        eventType: "Wedding reception",
        guestCount: 80,
        eventEndsAt: new Date(now + 7 * 86_400_000).toISOString(),
      },
      chatCustomerCookie,
    ),
    200,
  );
  assert.equal(updated.conversation.eventType, "Wedding reception");
  assert.equal(updated.conversation.guestCount, 80);

  const packageRemoved = await read(
    await call("/messages/conversation/context", "PATCH", { packageId: null }, chatCustomerCookie),
    200,
  );
  assert.equal(packageRemoved.conversation.packageId, null);
  const packageSelected = await read(
    await call("/messages/conversation/context", "PATCH", { packageId }, chatCustomerCookie),
    200,
  );
  assert.equal(packageSelected.conversation.packageId, packageId);

  await read(
    await call("/messages/conversation/messages", "POST", { body: "Can you help?" }, chatCustomerCookie),
    201,
  );
  const reply = await withGeminiMock(async () =>
    read(await call("/messages/conversation/assistant-reply", "POST", {}, chatCustomerCookie), 200),
  );
  assert.equal(reply.status, "active");
  assert.equal(reply.message.senderRole, "assistant");
  assert.equal(reply.message.senderId, null);
  assert.equal(reply.message.body, "Mocked reply");

  const waiting = await read(
    await call("/messages/conversation/request-staff", "POST", {}, chatCustomerCookie),
    200,
  );
  assert.equal(waiting.conversation.status, "waiting_staff");
  assert.match(waiting.messages.at(-1).body, /customer requested staff assistance/i);

  const list = await read(await call("/admin/conversations", "GET", undefined, adminCookie), 200);
  assert.equal(list.conversations[0].id, waiting.conversation.id);
  assert.equal(list.conversations[0].status, "waiting_staff");

  const paused = await read(
    await call("/messages/conversation/assistant-reply", "POST", {}, chatCustomerCookie),
    200,
  );
  assert.equal(paused.message, null);
  assert.equal(paused.status, "waiting_staff");

  const taken = await read(
    await call(
      `/admin/conversations/${waiting.conversation.id}/takeover`,
      "POST",
      {},
      adminCookie,
    ),
    200,
  );
  assert.equal(taken.conversation.status, "staff");
  assert.match(taken.messages.at(-1).body, /Admin Person has taken over this conversation/);

  const stillPaused = await read(
    await call("/messages/conversation/assistant-reply", "POST", {}, chatCustomerCookie),
    200,
  );
  assert.equal(stillPaused.message, null);
  assert.equal(stillPaused.status, "staff");

  // Importing a new browser chat must not quietly undo the takeover.
  const afterTakeover = await read(
    await call(
      "/messages/conversation/claim",
      "POST",
      {
        guestChatId: "guest-chat-after-takeover",
        messages: [{ role: "user", body: "One more thing" }],
      },
      chatCustomerCookie,
    ),
    200,
  );
  assert.equal(afterTakeover.conversation.status, "staff");

  // Asking for staff again must not hand a taken-over thread back to the queue.
  const stillTaken = await read(
    await call("/messages/conversation/request-staff", "POST", {}, chatCustomerCookie),
    200,
  );
  assert.equal(stillTaken.conversation.status, "staff");

  const returnedToAi = await read(
    await call(
      `/admin/conversations/${waiting.conversation.id}/return-to-ai`,
      "POST",
      {},
      adminCookie,
    ),
    200,
  );
  assert.equal(returnedToAi.conversation.status, "active");
  assert.match(returnedToAi.messages.at(-1).body, /Admin Person returned this conversation to AI responses/);

  const resumed = await withGeminiMock(async () =>
    read(await call("/messages/conversation/assistant-reply", "POST", {}, chatCustomerCookie), 200),
  );
  assert.equal(resumed.status, "active");
  assert.equal(resumed.message.senderRole, "assistant");
});

test("inactive and finished-event conversations close and keep their history", async () => {
  const current = await read(
    await call("/messages/conversation", "GET", undefined, chatCustomerCookie),
    200,
  );
  const count = current.messages.length;

  await db
    .updateTable("conversations")
    .set({
      status: "active",
      closed_at: null,
      package_id: null,
      event_starts_at: null,
      event_ends_at: null,
      created_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })
    .where("customer_id", "=", chatCustomerId)
    .execute();
  const expired = await read(
    await call("/messages/conversation", "GET", undefined, chatCustomerCookie),
    200,
  );
  assert.equal(expired.conversation.status, "closed");
  assert.ok(expired.conversation.closedAt);
  assert.equal(expired.messages.length, count);

  await read(
    await call("/messages/conversation/messages", "POST", { body: "Hello again" }, chatCustomerCookie),
    201,
  );
  const reopened = await read(
    await call("/messages/conversation", "GET", undefined, chatCustomerCookie),
    200,
  );
  assert.equal(reopened.conversation.status, "active");
  assert.equal(reopened.conversation.closedAt, null);
  assert.equal(reopened.conversation.packageId, null);
  assert.equal(reopened.messages.length, count + 1);

  await db
    .updateTable("conversations")
    .set({
      status: "active",
      closed_at: null,
      package_id: packageId,
      event_ends_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
      updated_at: new Date(),
    })
    .where("customer_id", "=", chatCustomerId)
    .execute();
  const eventExpired = await read(
    await call("/messages/conversation", "GET", undefined, chatCustomerCookie),
    200,
  );
  assert.equal(eventExpired.conversation.status, "closed");
});

test("message routes appear in the OpenAPI document", async () => {
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/messages/conversation"].get);
  assert.ok(spec.paths["/v1/messages/conversations"].post);
  assert.ok(spec.paths["/v1/messages/conversation/messages"].post);
  assert.ok(spec.paths["/v1/messages/conversation/claim"].post);
  assert.ok(spec.paths["/v1/messages/conversation/context"].patch);
  assert.ok(spec.paths["/v1/messages/conversation/request-staff"].post);
  assert.ok(spec.paths["/v1/messages/conversation/assistant-reply"].post);
  assert.ok(spec.paths["/v1/chatbot/guest-reply"].post);
  assert.ok(spec.paths["/v1/admin/conversations"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}/messages"].post);
  assert.ok(spec.paths["/v1/admin/conversations/{id}/takeover"].post);
  assert.ok(spec.paths["/v1/admin/conversations/{id}/return-to-ai"].post);
});
