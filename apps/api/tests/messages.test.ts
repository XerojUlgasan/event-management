import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import { Pool } from "pg";
import { sql } from "kysely";
import { hashSessionToken } from "../src/utils/session.js";
import { encodePageCursor } from "../src/utils/pagination.js";

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
    ["localhost", "127.0.0.1", "::1"].includes(
      process.env.DB_HOST ?? "localhost",
    ),
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
    let legacyCustomerId: string | undefined;
    let legacyConversationIds: string[] = [];

    if (entry.name === "20261101130000_remove_deferred_ai_conversation_state") {
      legacyCustomerId = (
        await pool.query(
          "INSERT INTO users (email, role, password_hash) VALUES ('legacy-messages@example.test', 'customer', 'unused') RETURNING id",
        )
      ).rows[0].id;
      legacyConversationIds = (
        await pool.query(
          "INSERT INTO conversations (customer_id, status, guest_chat_id) VALUES ($1, 'waiting_staff', 'old-guest-id'), ($1, 'staff', null), ($1, 'closed', null) RETURNING id",
          [legacyCustomerId],
        )
      ).rows.map((row) => row.id);
      await pool.query(
        "INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, $2, 'customer', 'Human question'), ($1, $2, 'admin', 'Human response'), ($1, null, 'assistant', 'AI response'), ($1, null, 'system', 'AI takeover notice')",
        [legacyConversationIds[0], legacyCustomerId],
      );
    }

    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );

    if (legacyCustomerId) {
      const conversations = await pool.query(
        "SELECT status FROM conversations WHERE id = ANY($1::uuid[])",
        [legacyConversationIds],
      );
      assert.deepEqual(conversations.rows.map((row) => row.status).sort(), [
        "active",
        "active",
        "closed",
      ]);
      const messages = await pool.query(
        "SELECT sender_role, body FROM messages WHERE conversation_id = $1 ORDER BY sender_role",
        [legacyConversationIds[0]],
      );
      assert.deepEqual(messages.rows, [
        { sender_role: "admin", body: "Human response" },
        { sender_role: "customer", body: "Human question" },
      ]);
      const guestColumn = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'guest_chat_id'",
      );
      assert.equal(guestColumn.rowCount, 0);
      await assert.rejects(
        pool.query("UPDATE conversations SET status = 'staff' WHERE id = $1", [
          legacyConversationIds[0],
        ]),
        /conversations_status_check/,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, $2, 'assistant', 'Should fail')",
          [legacyConversationIds[0], legacyCustomerId],
        ),
        /messages_sender_role_check/,
      );
      await assert.rejects(
        pool.query(
          "INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, null, 'customer', 'Should fail')",
          [legacyConversationIds[0]],
        ),
        /null value in column "sender_id"/,
      );
      await pool.query("DELETE FROM users WHERE id = $1", [legacyCustomerId]);
      // Replay this historical cleanup before later migrations extend senders.
      await pool.query(
        await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
      );
    }
  }

  // This human-messaging suite must never make live provider requests.
  delete process.env.AI_GATEWAY_API_KEY;
  process.env.DB_NAME = database;
  ({ app } = await import("../src/app.js"));
  ({ db } = await import("../src/db/client.js"));

  async function session(role: string, name: string) {
    const token = randomUUID();
    const user = await db
      .insertInto("users")
      .values({
        email: `${role}-${randomUUID()}@example.test`,
        display_name: name,
        password_hash: "unused",
        role,
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

  const pkg = await db
    .insertInto("packages")
    .values({
      name: "Garden Wedding",
      slug: "garden-wedding",
      max_guests: 100,
      price: 150_000,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  packageId = pkg.id;
});

after(async () => {
  await db?.destroy();
  await pool?.end();

  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
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

test("Realtime tokens are limited to the live session and requested receive scope", async (t) => {
  const existingKey = process.env.REALTIME_JWT_SIGNING_JWK;
  const existingSecret = process.env.REALTIME_JWT_SECRET;
  t.after(() => {
    if (existingKey === undefined) delete process.env.REALTIME_JWT_SIGNING_JWK;
    else process.env.REALTIME_JWT_SIGNING_JWK = existingKey;

    if (existingSecret === undefined) delete process.env.REALTIME_JWT_SECRET;
    else process.env.REALTIME_JWT_SECRET = existingSecret;
  });
  delete process.env.REALTIME_JWT_SIGNING_JWK;
  delete process.env.REALTIME_JWT_SECRET;

  const id = randomUUID();
  const guestConversationId = randomUUID();
  const guestIdentity = await db
    .insertInto("guest_chat_identities")
    .values({ token_hash: randomUUID() })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("conversations")
    .values([
      { id, customer_id: customerId },
      { id: guestConversationId, guest_identity_id: guestIdentity.id },
    ])
    .execute();
  t.after(async () => {
    await db
      .deleteFrom("conversations")
      .where("id", "in", [id, guestConversationId])
      .execute();
    await db
      .deleteFrom("guest_chat_identities")
      .where("id", "=", guestIdentity.id)
      .execute();
  });

  const issue = (conversationId: string, cookie?: string) =>
    call("/auth/realtime-token", "POST", { conversationId }, cookie);

  const issueNotifications = (cookie?: string) =>
    call("/auth/realtime-token", "POST", { scope: "notifications" }, cookie);

  await read(await issue(id), 401);
  await read(await issueNotifications(), 401);
  await read(await issue("invalid", customerCookie), 400);

  for (const scope of [
    { scope: "unknown" },
    { scope: "notifications", conversationId: id },
    { scope: "notifications", userId: otherCustomerId },
  ]) {
    await read(
      await call("/auth/realtime-token", "POST", scope, customerCookie),
      400,
    );
  }

  await read(await issue(id, otherCustomerCookie), 404);
  await read(await issue(guestConversationId, adminCookie), 404);
  await read(await issue(id, customerCookie), 503);
  await read(await issueNotifications(customerCookie), 503);

  const kid = randomUUID();
  const pair = await generateKeyPair("ES256", { extractable: true });
  process.env.REALTIME_JWT_SIGNING_JWK = JSON.stringify({
    ...(await exportJWK(pair.privateKey)),
    kid,
  });

  for (const cookie of [customerCookie, adminCookie]) {
    const response = await issue(id, cookie);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await read(response, 200);
    const { payload, protectedHeader } = await jwtVerify(
      result.token,
      pair.publicKey,
      {
        algorithms: ["ES256"],
        audience: "authenticated",
      },
    );
    const session = await db
      .selectFrom("sessions")
      .select(["id", "user_id"])
      .where(
        "token_hash",
        "=",
        hashSessionToken(cookie.slice("em_session=".length)),
      )
      .executeTakeFirstOrThrow();

    assert.equal(protectedHeader.kid, kid);
    assert.equal(payload.sub, session.user_id);
    assert.equal(payload.role, "authenticated");
    assert.equal(payload.clemora_scope, "conversation_messages");
    assert.equal(payload.clemora_session_id, session.id);
    assert.equal(payload.conversation_id, id);
    assert.ok(payload.exp && payload.iat);
    assert.equal(payload.exp - payload.iat, 300);
    assert.equal(new Date(result.expiresAt).getTime(), payload.exp * 1000);

    const notificationResponse = await issueNotifications(cookie);
    assert.equal(notificationResponse.headers.get("cache-control"), "no-store");
    const notificationResult = await read(notificationResponse, 200);
    const { payload: notificationPayload } = await jwtVerify(
      notificationResult.token,
      pair.publicKey,
      { algorithms: ["ES256"], audience: "authenticated" },
    );
    assert.equal(notificationPayload.sub, session.user_id);
    assert.equal(notificationPayload.role, "authenticated");
    assert.equal(notificationPayload.clemora_scope, "user_notifications");
    assert.equal(notificationPayload.clemora_session_id, session.id);
    assert.equal(notificationPayload.conversation_id, undefined);
    assert.ok(notificationPayload.exp && notificationPayload.iat);
    assert.equal(notificationPayload.exp - notificationPayload.iat, 300);
    assert.equal(
      new Date(notificationResult.expiresAt).getTime(),
      notificationPayload.exp * 1000,
    );
  }

  const shortSessionToken = randomUUID();
  const shortSessionCookie = `em_session=${shortSessionToken}`;
  const expiration = Math.floor(Date.now() / 1000) + 90;
  const shortSession = await db
    .insertInto("sessions")
    .values({
      user_id: customerId,
      token_hash: hashSessionToken(shortSessionToken),
      expires_at: new Date(expiration * 1000),
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const shortResult = await read(
    await issueNotifications(shortSessionCookie),
    200,
  );
  const { payload: shortPayload } = await jwtVerify(
    shortResult.token,
    pair.publicKey,
  );
  assert.equal(shortPayload.exp, expiration);

  await db.deleteFrom("sessions").where("id", "=", shortSession.id).execute();
  await read(await issueNotifications(shortSessionCookie), 401);
});

test("read receipts mark only incoming messages through a saved keyset boundary", async (t) => {
  const conversationId = randomUUID();
  const otherId = randomUUID();
  const afterBoundaryId = "00000000-0000-4000-8000-000000000003";
  const boundaryId = "00000000-0000-4000-8000-000000000002";
  const ownId = "00000000-0000-4000-8000-000000000001";
  const beforeId = randomUUID();
  const foreignId = randomUUID();
  await db
    .insertInto("conversations")
    .values([
      { id: conversationId, customer_id: customerId },
      { id: otherId, customer_id: customerId },
    ])
    .execute();
  t.after(async () => {
    await db
      .deleteFrom("conversations")
      .where("id", "in", [conversationId, otherId])
      .execute();
  });

  await db
    .insertInto("messages")
    .values([
      {
        id: beforeId,
        conversation_id: conversationId,
        sender_role: "assistant",
        body: "Previous",
        created_at: "2026-11-21T00:00:00.000001Z",
      },
      {
        id: ownId,
        conversation_id: conversationId,
        sender_role: "customer",
        sender_id: customerId,
        body: "Own message",
        created_at: "2026-11-21T00:00:00.000002Z",
      },
      {
        id: boundaryId,
        conversation_id: conversationId,
        sender_role: "assistant",
        body: "Boundary",
        created_at: "2026-11-21T00:00:00.000002Z",
      },
      {
        id: afterBoundaryId,
        conversation_id: conversationId,
        sender_role: "assistant",
        body: "Later by UUID",
        created_at: "2026-11-21T00:00:00.000002Z",
      },
      {
        id: foreignId,
        conversation_id: otherId,
        sender_role: "assistant",
        body: "Different conversation",
      },
    ])
    .execute();

  const customerPath = `/messages/conversations/${conversationId}/read`;
  const adminPath = `/admin/conversations/${conversationId}/read`;

  const receipt = (path: string, messageId: string, cookie?: string) =>
    call(path, "POST", { messageId }, cookie);

  const readAt = async (id: string) =>
    (
      await db
        .selectFrom("messages")
        .select("read_at")
        .where("id", "=", id)
        .executeTakeFirstOrThrow()
    ).read_at;

  await read(await receipt(customerPath, boundaryId), 401);
  await read(await receipt(customerPath, boundaryId, otherCustomerCookie), 404);
  await read(await receipt(adminPath, boundaryId, customerCookie), 403);
  await read(await receipt(customerPath, foreignId, customerCookie), 404);
  await read(await receipt(customerPath, randomUUID(), customerCookie), 404);
  assert.equal(await readAt(boundaryId), null);

  await read(await receipt(customerPath, boundaryId, customerCookie), 204);
  assert.ok(await readAt(beforeId));
  const firstReceipt = await readAt(boundaryId);
  assert.ok(firstReceipt);
  assert.equal(await readAt(ownId), null);
  assert.equal(await readAt(afterBoundaryId), null);
  assert.equal(await readAt(foreignId), null);
  await read(await receipt(customerPath, boundaryId, customerCookie), 204);
  assert.deepEqual(await readAt(boundaryId), firstReceipt);

  await read(await receipt(adminPath, boundaryId, adminCookie), 204);
  assert.ok(await readAt(ownId));
  assert.equal(await readAt(afterBoundaryId), null);
});

test("customer request IDs replay safely and reject collisions", async () => {
  const ids = Array.from({ length: 3 }, () => randomUUID());

  await db
    .insertInto("conversations")
    .values([
      { id: ids[0], customer_id: customerId, ai_enabled: false },
      { id: ids[1], customer_id: customerId, ai_enabled: false },
      { id: ids[2], customer_id: otherCustomerId, ai_enabled: false },
    ])
    .execute();
  const requestId = randomUUID();
  const payload = { conversationId: ids[0], body: "Retry safely", requestId };
  const responses = await Promise.all([
    call("/messages/conversation/messages", "POST", payload, customerCookie),
    call("/messages/conversation/messages", "POST", payload, customerCookie),
  ]);

  const results = await Promise.all(
    responses.map((response) => read(response, 201)),
  );

  assert.deepEqual(results[0].message, results[1].message);
  assert.equal(results[0].message.id, requestId);
  assert.equal(
    (
      await db
        .selectFrom("messages")
        .select("id")
        .where("id", "=", requestId)
        .execute()
    ).length,
    1,
  );
  assert.deepEqual(
    await read(
      await call(
        "/messages/conversation/messages",
        "POST",
        { ...payload, body: "Changed" },
        customerCookie,
      ),
      409,
    ),
    { error: "Message request conflict" },
  );
  const adminId = (
    await db
      .selectFrom("users")
      .select("id")
      .where("role", "=", "admin")
      .executeTakeFirstOrThrow()
  ).id;
  const adminMessageId = randomUUID();
  await db
    .insertInto("messages")
    .values({
      id: adminMessageId,
      conversation_id: ids[1],
      sender_id: adminId,
      sender_role: "admin",
      body: "Retry safely",
    })
    .execute();
  assert.deepEqual(
    await read(
      await call(
        "/messages/conversation/messages",
        "POST",
        { ...payload, conversationId: ids[1], requestId: adminMessageId },
        customerCookie,
      ),
      409,
    ),
    { error: "Message request conflict" },
  );
  assert.deepEqual(
    await read(
      await call(
        "/messages/conversation/messages",
        "POST",
        { ...payload, conversationId: ids[1] },
        customerCookie,
      ),
      409,
    ),
    { error: "Message request conflict" },
  );
  assert.deepEqual(
    await read(
      await call(
        "/messages/conversation/messages",
        "POST",
        { ...payload, conversationId: ids[2] },
        otherCustomerCookie,
      ),
      409,
    ),
    { error: "Message request conflict" },
  );
  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { ...payload, conversationId: ids[0] },
      otherCustomerCookie,
    ),
    404,
  );
  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { ...payload, requestId: "invalid" },
      customerCookie,
    ),
    400,
  );

  const updatedAt = new Date("2020-01-01T00:00:00Z");
  await db
    .updateTable("conversations")
    .set({ updated_at: updatedAt })
    .where("id", "=", ids[0])
    .execute();
  const replay = await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      payload,
      customerCookie,
    ),
    201,
  );
  assert.deepEqual(replay, {
    message: results[0].message,
    assistantMessage: null,
    assistantError: null,
  });
  const closed = await db
    .selectFrom("conversations")
    .select("updated_at")
    .where("id", "=", ids[0])
    .executeTakeFirstOrThrow();
  assert.equal(closed.updated_at.getTime(), updatedAt.getTime());

  const sharedId = randomUUID();
  const collision = await Promise.all([
    call(
      "/messages/conversation/messages",
      "POST",
      { conversationId: ids[1], body: "Collision", requestId: sharedId },
      customerCookie,
    ),
    call(
      "/messages/conversation/messages",
      "POST",
      { conversationId: ids[2], body: "Collision", requestId: sharedId },
      otherCustomerCookie,
    ),
  ]);
  assert.deepEqual(
    collision.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.equal(
    (
      await db
        .selectFrom("messages")
        .select("id")
        .where("id", "=", sharedId)
        .execute()
    ).length,
    1,
  );
  await db.deleteFrom("conversations").where("id", "in", ids).execute();
});

test("customer and admin conversations enforce roles and validate messages", async () => {
  await read(await call("/messages/conversation"), 401);
  await read(await call("/admin/conversations"), 401);
  await read(
    await call("/messages/conversation", "GET", undefined, adminCookie),
    403,
  );
  await read(
    await call("/admin/conversations", "GET", undefined, customerCookie),
    403,
  );
  await read(
    await call("/admin/conversations", "GET", undefined, adminCookie),
    200,
  );

  const empty = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );
  assert.equal(empty.messages.length, 0);
  assert.equal(empty.conversation.customerId, customerId);
  assert.equal(empty.conversation.customerName, "Customer One");
  assert.equal(empty.conversation.unreadCount, 0);
  const again = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );
  assert.equal(again.conversation.id, empty.conversation.id);

  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "   " },
      customerCookie,
    ),
    400,
  );
  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "x".repeat(4001) },
      customerCookie,
    ),
    400,
  );
  await read(
    await call("/messages/conversation/messages", "POST", {
      body: "No session",
    }),
    401,
  );
  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "Admin cannot use customer route" },
      adminCookie,
    ),
    403,
  );

  const sent = await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "  Hello team  " },
      customerCookie,
    ),
    201,
  );
  assert.equal(sent.message.body, "Hello team");
  assert.equal(sent.message.senderRole, "customer");
  assert.equal(sent.message.senderId, customerId);
  assert.equal(sent.message.senderName, "Customer One");
  assert.equal(sent.message.readAt, null);
  const customerListAfterSend = await read(
    await call("/messages/conversations", "GET", undefined, customerCookie),
    200,
  );
  assert.equal(customerListAfterSend.conversations[0].unreadCount, 0);

  const list = await read(
    await call("/admin/conversations", "GET", undefined, adminCookie),
    200,
  );
  assert.equal(list.conversations.length, 1);
  assert.equal(list.conversations[0].id, empty.conversation.id);
  assert.equal(list.conversations[0].unreadCount, 1);
  assert.equal(list.conversations[0].lastMessage.body, "Hello team");

  const thread = await read(
    await call(
      `/admin/conversations/${empty.conversation.id}`,
      "GET",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.equal(thread.messages.length, 1);
  assert.ok(thread.messages[0].readAt);
  assert.equal(thread.conversation.unreadCount, 0);
  assert.equal(
    (
      await read(
        await call("/admin/conversations", "GET", undefined, adminCookie),
        200,
      )
    ).conversations[0].unreadCount,
    0,
  );

  const reply = await read(
    await call(
      `/admin/conversations/${empty.conversation.id}/messages`,
      "POST",
      { body: " We can help " },
      adminCookie,
    ),
    201,
  );
  assert.equal(reply.message.body, "We can help");
  assert.equal(reply.message.senderRole, "admin");
  assert.equal(reply.message.senderName, "Admin Person");
  assert.equal(reply.message.readAt, null);
  const customerListAfterReply = await read(
    await call("/messages/conversations", "GET", undefined, customerCookie),
    200,
  );
  assert.equal(customerListAfterReply.conversations[0].unreadCount, 1);

  const customerThread = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );
  assert.deepEqual(
    customerThread.messages.map((message: any) => message.body).sort(),
    ["Hello team", "We can help"],
  );
  assert.ok(
    customerThread.messages.find(
      (message: any) => message.senderRole === "admin",
    ).readAt,
  );
  const customerListAfterRead = await read(
    await call("/messages/conversations", "GET", undefined, customerCookie),
    200,
  );
  assert.equal(customerListAfterRead.conversations[0].unreadCount, 0);

  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "One more question" },
      customerCookie,
    ),
    201,
  );
  const unread = await read(
    await call("/admin/conversations", "GET", undefined, adminCookie),
    200,
  );
  assert.equal(unread.conversations[0].unreadCount, 1);
  assert.equal(unread.conversations[0].lastMessage.body, "One more question");
});

test("conversations are isolated per customer and unknown ids return 404", async () => {
  const other = await read(
    await call("/messages/conversation", "GET", undefined, otherCustomerCookie),
    200,
  );
  assert.equal(other.conversation.customerId, otherCustomerId);
  assert.equal(other.messages.length, 0);

  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "Second customer here" },
      otherCustomerCookie,
    ),
    201,
  );

  const list = await read(
    await call("/admin/conversations", "GET", undefined, adminCookie),
    200,
  );
  assert.equal(list.conversations.length, 2);
  assert.equal(
    list.conversations.filter((item: any) => item.unreadCount === 1).length,
    2,
  );

  const mine = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );
  assert.ok(
    mine.messages.every(
      (message: any) => message.body !== "Second customer here",
    ),
  );

  await read(
    await call(
      `/admin/conversations/${randomUUID()}`,
      "GET",
      undefined,
      adminCookie,
    ),
    404,
  );
  await read(
    await call(
      `/admin/conversations/${randomUUID()}/messages`,
      "POST",
      { body: "hello" },
      adminCookie,
    ),
    404,
  );
});

test("customers can start a separate conversation without losing the previous one", async () => {
  const previous = await read(
    await call("/messages/conversation", "GET", undefined, otherCustomerCookie),
    200,
  );
  const created = await read(
    await call("/messages/conversations", "POST", {}, otherCustomerCookie),
    201,
  );
  assert.notEqual(created.conversation.id, previous.conversation.id);
  assert.equal(created.messages.length, 0);
  const current = await read(
    await call("/messages/conversation", "GET", undefined, otherCustomerCookie),
    200,
  );
  assert.equal(current.conversation.id, created.conversation.id);
  assert.equal(current.messages.length, 0);
  const old = await read(
    await call(
      `/admin/conversations/${previous.conversation.id}`,
      "GET",
      undefined,
      adminCookie,
    ),
    200,
  );
  assert.ok(
    old.messages.some(
      (message: any) => message.body === "Second customer here",
    ),
  );
});

test("old general threads stay available", async () => {
  const thread = await read(
    await call("/messages/conversation", "GET", undefined, chatCustomerCookie),
    200,
  );

  for (const field of [
    "packageId",
    "packageName",
    "bookingRequestId",
    "eventType",
    "eventStartsAt",
    "eventEndsAt",
    "guestCount",
  ]) {
    assert.equal(thread.conversation[field], null);
  }

  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await db
    .updateTable("conversations")
    .set({ created_at: old })
    .where("id", "=", thread.conversation.id)
    .execute();
  const active = await read(
    await call(
      `/messages/conversations/${thread.conversation.id}`,
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    200,
  );
  assert.equal("status" in active.conversation, false);
  assert.equal("expiresAt" in active.conversation, false);
  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "Can you help?", conversationId: thread.conversation.id },
      chatCustomerCookie,
    ),
    201,
  );
  await read(
    await call(
      "/messages/conversation/messages",
      "POST",
      { body: "Hello again", conversationId: thread.conversation.id },
      chatCustomerCookie,
    ),
    201,
  );
  const reopened = await read(
    await call(
      `/messages/conversations/${thread.conversation.id}`,
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    200,
  );
  assert.equal("closedAt" in reopened.conversation, false);
  assert.deepEqual(
    reopened.messages.map((message: any) => message.body),
    ["Can you help?", "Hello again"],
  );
  assert.equal(
    (
      await db
        .selectFrom("conversations")
        .select("created_at")
        .where("id", "=", thread.conversation.id)
        .executeTakeFirstOrThrow()
    ).created_at.toISOString(),
    old.toISOString(),
  );
});

test("old booking conversations remain available", async () => {
  for (const pastEnd of [false, true]) {
    const booking = (
      await read(
        await call(
          "/booking-requests",
          "POST",
          {
            packageId,
            eventType: "Wedding",
            durationMode: "one_day",
            requestedDays: [{ date: "2099-01-02" }],
            timeZone: "Asia/Manila",
            guestCount: 80,
            contactName: "Customer",
            phoneNumber: "123",
          },
          chatCustomerCookie,
        ),
        201,
      )
    ).bookingRequest;

    const linked = (
      await read(
        await call(
          "/messages/conversations",
          "GET",
          undefined,
          chatCustomerCookie,
        ),
        200,
      )
    ).conversations.find((item: any) => item.bookingRequestId === booking.id);

    assert.ok(linked);
    assert.equal(linked.eventPreferredDate, "2099-01-02");
    const byReference = await read(
      await call(
        `/messages/conversations?reference=${encodeURIComponent(booking.reference)}`,
        "GET",
        undefined,
        chatCustomerCookie,
      ),
      200,
    );
    assert.equal(byReference.conversations[0]?.id, linked.id);
    const otherLookup = await read(
      await call(
        `/messages/conversations?reference=${encodeURIComponent(booking.reference)}`,
        "GET",
        undefined,
        otherCustomerCookie,
      ),
      200,
    );
    assert.equal(otherLookup.conversations.length, 0);
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db
      .updateTable("conversations")
      .set({ created_at: old })
      .where("id", "=", linked.id)
      .execute();

    if (pastEnd) {
      await db
        .updateTable("booking_requests")
        .set({ starts_at: new Date(old.getTime() - 3600000), ends_at: old })
        .where("id", "=", booking.id)
        .execute();
    }

    for (const [path, cookie] of [
      ["/messages/conversations", chatCustomerCookie],
      ["/admin/conversations", adminCookie],
    ] as const) {
      const list = await read(await call(path, "GET", undefined, cookie), 200);

      const row = list.conversations.find((item: any) => item.id === linked.id);

      assert.equal("status" in row, false);
      assert.equal("expiresAt" in row, false);
    }

    for (const [path, cookie] of [
      [`/messages/conversations/${linked.id}`, chatCustomerCookie],
      [`/admin/conversations/${linked.id}`, adminCookie],
    ] as const) {
      const result = await read(
        await call(path, "GET", undefined, cookie),
        200,
      );
      assert.equal("status" in result.conversation, false);
      assert.equal(
        result.conversation.eventEndsAt,
        pastEnd ? old.toISOString() : null,
      );
    }

    await read(
      await call(
        "/messages/conversation/messages",
        "POST",
        { body: "Customer message", conversationId: linked.id },
        chatCustomerCookie,
      ),
      201,
    );
    await read(
      await call(
        `/admin/conversations/${linked.id}/messages`,
        "POST",
        { body: "Admin reply" },
        adminCookie,
      ),
      201,
    );
    const closed = await read(
      await call(
        `/messages/conversations/${linked.id}`,
        "GET",
        undefined,
        chatCustomerCookie,
      ),
      200,
    );
    assert.equal("status" in closed.conversation, false);
    assert.deepEqual(
      closed.messages.map((message: any) => message.body),
      ["Customer message", "Admin reply"],
    );
  }
});

test("message routes appear in the OpenAPI document", async () => {
  const spec: any = await (await app.request("/openapi.json")).json();
  const threadSchema =
    spec.paths["/v1/messages/conversation"].get.responses["200"].content[
      "application/json"
    ].schema;
  assert.equal(
    "status" in threadSchema.properties.conversation.properties,
    false,
  );
  assert.equal(
    "closedAt" in threadSchema.properties.conversation.properties,
    false,
  );
  assert.equal(
    "expiresAt" in threadSchema.properties.conversation.properties,
    false,
  );
  assert.ok(spec.paths["/v1/messages/conversations"].post);
  assert.ok(spec.paths["/v1/messages/conversation/messages"].post);
  assert.ok(
    spec.paths["/v1/messages/conversations/{id}/read"].post.responses["204"],
  );
  assert.ok(
    spec.paths["/v1/admin/conversations/{id}/read"].post.responses["204"],
  );
  const realtimeToken = spec.paths["/v1/auth/realtime-token"].post;
  assert.ok(realtimeToken.responses["200"]);
  const scopes =
    realtimeToken.requestBody.content["application/json"].schema.anyOf;
  assert.deepEqual(
    scopes.map(({ required }: { required: string[] }) => required),
    [["conversationId"], ["scope"]],
  );
  assert.equal(scopes[1].additionalProperties, false);
  assert.deepEqual(scopes[1].properties.scope.enum, ["notifications"]);

  assert.equal(spec.paths["/v1/messages/conversation/context"], undefined);

  assert.ok(spec.paths["/v1/admin/conversations"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}/messages"].post);
});

test("admin conversation pages include empty threads and order by precise update time and id", async () => {
  const ids = Array.from({ length: 31 }, () => randomUUID())
    .sort()
    .reverse();

  await db
    .insertInto("conversations")
    .values(
      ids.map((id) => ({
        id,
        customer_id: customerId,
        updated_at: new Date("2090-01-01T00:00:00.000Z"),
      })),
    )
    .execute();
  // These differ within one millisecond, which a JavaScript Date cannot represent.
  await sql`update conversations set updated_at = '2090-01-01T00:00:00.000002Z' where id = any(${ids.slice(0, 14)}::uuid[])`.execute(
    db,
  );
  await sql`update conversations set updated_at = '2090-01-01T00:00:00.000001Z' where id = ${ids[14]}::uuid`.execute(
    db,
  );
  await db
    .insertInto("messages")
    .values({
      conversation_id: ids[0],
      sender_id: customerId,
      sender_role: "customer",
      body: "Page preview",
    })
    .execute();

  await read(
    await call(
      "/admin/conversations?cursor=invalid",
      "GET",
      undefined,
      adminCookie,
    ),
    400,
  );
  const pages: any[] = [];
  let cursor: string | null = null;

  do {
    const page = await read(
      await call(
        `/admin/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        "GET",
        undefined,
        adminCookie,
      ),
      200,
    );
    assert.ok(page.conversations.length <= 15);

    if (pages.length === 0) assert.equal(page.conversations.length, 15);

    pages.push(...page.conversations);
    cursor = page.nextCursor;
  } while (cursor);

  assert.deepEqual(
    pages.slice(0, 31).map((item: any) => item.id),
    ids,
  );
  assert.equal(new Set(pages.map((item: any) => item.id)).size, pages.length);

  const preview = pages.find((item: any) => item.id === ids[0]);

  assert.equal(preview.lastMessage.body, "Page preview");
  assert.equal(preview.unreadCount, 1);

  const empty = pages.find((item: any) => item.id === ids[1]);

  assert.equal(empty.lastMessage, null);
  assert.equal(empty.unreadCount, 0);
  await db.deleteFrom("conversations").where("id", "in", ids).execute();
});

test("legacy AI routes remain absent and unconfigured generation creates no assistant messages", async () => {
  const spec: any = await (await app.request("/openapi.json")).json();
  const customerThread = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );

  for (const path of [
    "/chatbot/guest-reply",
    "/messages/conversation/claim",
    "/messages/conversation/request-staff",
    "/messages/conversation/assistant-reply",
    `/admin/conversations/${customerThread.conversation.id}/takeover`,
    `/admin/conversations/${customerThread.conversation.id}/return-to-ai`,
  ]) {
    assert.equal(
      (
        await call(
          path,
          "POST",
          {},
          path.startsWith("/admin") ? adminCookie : customerCookie,
        )
      ).status,
      404,
    );
    assert.equal(
      spec.paths[`/v1${path.replace(customerThread.conversation.id, "{id}")}`],
      undefined,
    );
  }

  assert.equal(
    (
      await db
        .selectFrom("messages")
        .select("id")
        .where("sender_role", "not in", ["customer", "admin"])
        .execute()
    ).length,
    0,
  );
});

test("customer conversation and thread pages are bounded, scoped, and keep precise boundaries", async () => {
  const conversations = Array.from({ length: 7 }, () => randomUUID())
    .sort()
    .reverse();

  await db
    .insertInto("conversations")
    .values(
      conversations.map((id) => ({
        id,
        customer_id: chatCustomerId,
        updated_at: new Date("2091-01-01T00:00:00Z"),
      })),
    )
    .execute();
  await sql`update conversations set updated_at = '2091-01-01T00:00:00.000002Z' where id = any(${conversations.slice(0, 3)}::uuid[])`.execute(
    db,
  );
  await sql`update conversations set updated_at = '2091-01-01T00:00:00.000001Z' where id = ${conversations[3]}::uuid`.execute(
    db,
  );
  const ids: string[] = [];
  let cursor: string | null = null;

  do {
    const page = await read(
      await call(
        `/messages/conversations?limit=3${cursor ? `&cursor=${cursor}` : ""}`,
        "GET",
        undefined,
        chatCustomerCookie,
      ),
      200,
    );
    assert.ok(page.conversations.length <= 3);
    ids.push(...page.conversations.map((item: any) => item.id));
    cursor = page.nextCursor;
  } while (cursor);

  assert.deepEqual(ids.slice(0, 7), conversations);
  assert.equal(new Set(ids).size, ids.length);
  const firstPage = await read(
    await call(
      "/messages/conversations?limit=3",
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    200,
  );
  await read(
    await call(
      `/messages/conversations?cursor=${firstPage.nextCursor}`,
      "GET",
      undefined,
      customerCookie,
    ),
    400,
  );
  await read(
    await call(
      "/messages/conversations?limit=51",
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    400,
  );
  const invalidDate = "0000-01-01T00:00:00.000000Z";
  const forgedCustomer = encodePageCursor(
    `customer-conversations:${chatCustomerId}:`,
    { updatedAt: invalidDate, id: conversations[0] },
  );
  const forgedAdmin = encodePageCursor("admin-conversations", {
    updatedAt: invalidDate,
    id: conversations[0],
  });
  await read(
    await call(
      `/messages/conversations?cursor=${forgedCustomer}`,
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    400,
  );
  await read(
    await call(
      `/admin/conversations?cursor=${forgedAdmin}`,
      "GET",
      undefined,
      adminCookie,
    ),
    400,
  );

  const messageIds = Array.from({ length: 7 }, () => randomUUID())
    .sort()
    .reverse();

  await db
    .insertInto("messages")
    .values(
      messageIds.map((id) => ({
        id,
        conversation_id: conversations[0],
        sender_id: chatCustomerId,
        sender_role: "customer",
        body: id,
        created_at: new Date("2091-02-01T00:00:00Z"),
      })),
    )
    .execute();
  await sql`update messages set created_at = '2091-02-01T00:00:00.000002Z' where id = any(${messageIds.slice(0, 3)}::uuid[])`.execute(
    db,
  );
  await sql`update messages set created_at = '2091-02-01T00:00:00.000001Z' where id = ${messageIds[3]}::uuid`.execute(
    db,
  );
  const threadPath = `/messages/conversations/${conversations[0]}`;
  const latest = await read(
    await call(`${threadPath}?limit=3`, "GET", undefined, chatCustomerCookie),
    200,
  );
  assert.deepEqual(
    latest.messages.map((item: any) => item.id),
    messageIds.slice(0, 3).reverse(),
  );
  const older = await read(
    await call(
      `${threadPath}?limit=3&cursor=${latest.nextCursor}`,
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    200,
  );
  const oldest = await read(
    await call(
      `${threadPath}?limit=3&cursor=${older.nextCursor}`,
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    200,
  );
  assert.deepEqual(
    [...oldest.messages, ...older.messages, ...latest.messages].map(
      (item: any) => item.id,
    ),
    [...messageIds].reverse(),
  );
  const forgedThread = encodePageCursor(`thread:${conversations[0]}`, {
    createdAt: invalidDate,
    id: messageIds[0],
  });
  await read(
    await call(
      `${threadPath}?cursor=${forgedThread}`,
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    400,
  );
  await read(
    await call(
      `/messages/conversations/${conversations[1]}?cursor=${latest.nextCursor}`,
      "GET",
      undefined,
      chatCustomerCookie,
    ),
    400,
  );
  await read(
    await call(
      `${threadPath}?cursor=${latest.nextCursor}`,
      "GET",
      undefined,
      otherCustomerCookie,
    ),
    404,
  );
  await db
    .deleteFrom("conversations")
    .where("id", "in", conversations)
    .execute();
});
