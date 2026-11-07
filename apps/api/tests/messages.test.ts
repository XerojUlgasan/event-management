import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { dropTestDatabase } from "./helpers/drop-test-database.js";
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
    let legacyCustomerId: string | undefined;
    let legacyConversationIds: string[] = [];
    if (entry.name === "20261101130000_remove_deferred_ai_conversation_state") {
      legacyCustomerId = (await pool.query("INSERT INTO users (email, role, password_hash) VALUES ('legacy-messages@example.test', 'customer', 'unused') RETURNING id")).rows[0].id;
      legacyConversationIds = (await pool.query("INSERT INTO conversations (customer_id, status, guest_chat_id) VALUES ($1, 'waiting_staff', 'old-guest-id'), ($1, 'staff', null), ($1, 'closed', null) RETURNING id", [legacyCustomerId])).rows.map(row => row.id);
      await pool.query("INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, $2, 'customer', 'Human question'), ($1, $2, 'admin', 'Human response'), ($1, null, 'assistant', 'AI response'), ($1, null, 'system', 'AI takeover notice')", [legacyConversationIds[0], legacyCustomerId]);
    }
    await pool.query(await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"));
    if (legacyCustomerId) {
      const conversations = await pool.query("SELECT status FROM conversations WHERE id = ANY($1::uuid[])", [legacyConversationIds]);
      assert.deepEqual(conversations.rows.map(row => row.status).sort(), ['active', 'active', 'closed']);
      const messages = await pool.query("SELECT sender_role, body FROM messages WHERE conversation_id = $1 ORDER BY sender_role", [legacyConversationIds[0]]);
      assert.deepEqual(messages.rows, [{ sender_role: 'admin', body: 'Human response' }, { sender_role: 'customer', body: 'Human question' }]);
      const guestColumn = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'guest_chat_id'");
      assert.equal(guestColumn.rowCount, 0);
      await assert.rejects(pool.query("UPDATE conversations SET status = 'staff' WHERE id = $1", [legacyConversationIds[0]]), /conversations_status_check/);
      await assert.rejects(pool.query("INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, $2, 'assistant', 'Should fail')", [legacyConversationIds[0], legacyCustomerId]), /messages_sender_role_check/);
      await assert.rejects(pool.query("INSERT INTO messages (conversation_id, sender_id, sender_role, body) VALUES ($1, null, 'customer', 'Should fail')", [legacyConversationIds[0]]), /null value in column "sender_id"/);
      await pool.query("DELETE FROM users WHERE id = $1", [legacyCustomerId]);
    }

  }
  const cleanupSql = await readFile(new URL("20261101130000_remove_deferred_ai_conversation_state/migration.sql", root), "utf8");
  // Forward cleanup is safe to reapply and never touches human transcripts.
  await pool.query(cleanupSql);
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

  const pkg = await db.insertInto("packages").values({
    name: "Garden Wedding",
    max_guests: 100,
    price: 150_000,
  }).returning("id").executeTakeFirstOrThrow();
  packageId = pkg.id;
});

after(async () => {
  await db?.destroy();
  await pool?.end();
  if (admin) {
    try {
      await dropTestDatabase(admin, database);
    } finally {
      await admin.end();
    }
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
  const customerListAfterSend = await read(await call("/messages/conversations", "GET", undefined, customerCookie), 200);
  assert.equal(customerListAfterSend.conversations[0].unreadCount, 0);

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
  const customerListAfterReply = await read(await call("/messages/conversations", "GET", undefined, customerCookie), 200);
  assert.equal(customerListAfterReply.conversations[0].unreadCount, 1);

  const customerThread = await read(
    await call("/messages/conversation", "GET", undefined, customerCookie),
    200,
  );
  assert.deepEqual(
    customerThread.messages.map((message: any) => message.body).sort(),
    ["Hello team", "We can help"],
  );
  assert.ok(customerThread.messages.find((message: any) => message.senderRole === "admin").readAt);
  const customerListAfterRead = await read(await call("/messages/conversations", "GET", undefined, customerCookie), 200);
  assert.equal(customerListAfterRead.conversations[0].unreadCount, 0);

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

test("general threads have no booking context and can reopen after expiry", async () => {
  const thread = await read(await call("/messages/conversation", "GET", undefined, chatCustomerCookie), 200);
  for (const field of ["packageId", "packageName", "bookingRequestId", "eventType", "eventStartsAt", "eventEndsAt", "guestCount"]) {
    assert.equal(thread.conversation[field], null);
  }
  await read(await call("/messages/conversation/messages", "POST", { body: "Can you help?", conversationId: thread.conversation.id }, chatCustomerCookie), 201);
  await db.updateTable("conversations").set({ created_at: new Date(Date.now() - 25 * 60 * 60 * 1000) }).where("id", "=", thread.conversation.id).execute();
  const expired = await read(await call(`/messages/conversations/${thread.conversation.id}`, "GET", undefined, chatCustomerCookie), 200);
  assert.equal(expired.conversation.status, "closed");
  await read(await call("/messages/conversation/messages", "POST", { body: "Hello again", conversationId: thread.conversation.id }, chatCustomerCookie), 201);
  const reopened = await read(await call(`/messages/conversations/${thread.conversation.id}`, "GET", undefined, chatCustomerCookie), 200);
  assert.equal(reopened.conversation.status, "active");
  assert.deepEqual(reopened.messages.map((message: any) => message.body), ["Can you help?", "Hello again"]);
});

test("booking conversations derive context and remain closed after expiry", async () => {
  const booking = (await read(await call("/booking-requests", "POST", {
    packageId, eventType: "Wedding", preferredDate: "2099-01-02",
    estimatedDuration: "8_hours", guestCount: 80, contactName: "Customer", phoneNumber: "123",
  }, chatCustomerCookie), 201)).bookingRequest;
  assert.equal(booking.packageName, "Garden Wedding");
  assert.deepEqual(booking.packagePrice, { kind: "fixed", currency: "PHP", amountMinor: 15_000_000 });
  assert.equal(booking.packageMaxGuests, 100);
  const linked = (await read(await call("/messages/conversations", "GET", undefined, chatCustomerCookie), 200)).conversations.find((item: any) => item.bookingRequestId === booking.id);
  assert.ok(linked);
  assert.equal(linked.packageId, packageId);
  assert.equal(linked.packageName, "Garden Wedding");
  assert.equal(linked.eventType, "Wedding");
  assert.equal(linked.guestCount, 80);
  assert.equal(linked.eventEndsAt, null);
  await db.updateTable("conversations").set({ created_at: new Date(Date.now() - 25 * 60 * 60 * 1000) }).where("id", "=", linked.id).execute();
  const activeOverdue = await read(await call(`/messages/conversations/${linked.id}`, "GET", undefined, chatCustomerCookie), 200);
  assert.equal(activeOverdue.conversation.status, "active");
  assert.equal(activeOverdue.conversation.expiresAt, null);
  const endsAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const startsAt = new Date(endsAt.getTime() - 60 * 60 * 1000);
  await db.updateTable("booking_requests").set({ event_type: "Reception", guest_count: 90, starts_at: startsAt, ends_at: endsAt }).where("id", "=", booking.id).execute();
  const expired = await read(await call(`/messages/conversations/${linked.id}`, "GET", undefined, chatCustomerCookie), 200);
  assert.equal(expired.conversation.eventType, "Reception");
  assert.equal(expired.conversation.guestCount, 90);
  assert.equal(expired.conversation.eventStartsAt, startsAt.toISOString());
  assert.equal(expired.conversation.eventEndsAt, endsAt.toISOString());
  assert.equal(expired.conversation.expiresAt, new Date(endsAt.getTime() + 24 * 60 * 60 * 1000).toISOString());
  assert.equal(expired.conversation.status, "closed");
  await read(await call("/messages/conversation/messages", "POST", { body: "Hello", conversationId: linked.id }, chatCustomerCookie), 409);
  await read(await call(`/admin/conversations/${linked.id}/messages`, "POST", { body: "Hello" }, adminCookie), 409);
  const stillClosed = await read(await call(`/messages/conversations/${linked.id}`, "GET", undefined, chatCustomerCookie), 200);
  assert.equal(stillClosed.conversation.status, "closed");
  assert.equal(stillClosed.messages.length, 0);
  const fresh = await read(await call("/messages/conversations", "POST", {}, chatCustomerCookie), 201);
  await read(await call("/messages/conversation/messages", "POST", { body: "New question", conversationId: fresh.conversation.id }, chatCustomerCookie), 201);
});

test("message routes appear in the OpenAPI document", async () => {
  const spec: any = await (await app.request("/openapi.json")).json();
  assert.ok(spec.paths["/v1/messages/conversation"].get);
  assert.ok(spec.paths["/v1/messages/conversations"].post);
  assert.ok(spec.paths["/v1/messages/conversation/messages"].post);

  assert.equal(spec.paths["/v1/messages/conversation/context"], undefined);

  assert.ok(spec.paths["/v1/admin/conversations"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}"].get);
  assert.ok(spec.paths["/v1/admin/conversations/{id}/messages"].post);

});

test("admin conversation pages include empty threads and order by precise update time and id", async () => {
  const ids = Array.from({ length: 31 }, () => randomUUID()).sort().reverse();
  await db.insertInto("conversations").values(ids.map((id) => ({
    id,
    customer_id: customerId,
    status: "active",
    updated_at: new Date("2090-01-01T00:00:00.000Z"),
  }))).execute();
  // These differ within one millisecond, which a JavaScript Date cannot represent.
  await sql`update conversations set updated_at = '2090-01-01T00:00:00.000002Z' where id = any(${ids.slice(0, 14)}::uuid[])`.execute(db);
  await sql`update conversations set updated_at = '2090-01-01T00:00:00.000001Z' where id = ${ids[14]}::uuid`.execute(db);
  await db.insertInto("messages").values({
    conversation_id: ids[0], sender_id: customerId, sender_role: "customer", body: "Page preview",
  }).execute();

  await read(await call("/admin/conversations?cursor=invalid", "GET", undefined, adminCookie), 400);
  const pages: any[] = [];
  let cursor: string | null = null;
  do {
    const page = await read(await call(`/admin/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, "GET", undefined, adminCookie), 200);
    assert.ok(page.conversations.length <= 15);
    if (pages.length === 0) assert.equal(page.conversations.length, 15);
    pages.push(...page.conversations);
    cursor = page.nextCursor;
  } while (cursor);

  assert.deepEqual(pages.slice(0, 31).map((item: any) => item.id), ids);
  assert.equal(new Set(pages.map((item: any) => item.id)).size, pages.length);
  const preview = pages.find((item: any) => item.id === ids[0]);
  assert.equal(preview.lastMessage.body, "Page preview");
  assert.equal(preview.unreadCount, 1);
  const empty = pages.find((item: any) => item.id === ids[1]);
  assert.equal(empty.lastMessage, null);
  assert.equal(empty.unreadCount, 0);
  await db.deleteFrom("conversations").where("id", "in", ids).execute();
});

test("deferred AI routes are absent and cannot create automated replies", async () => {
  const spec: any = await (await app.request("/openapi.json")).json();
  const customerThread = await read(await call("/messages/conversation", "GET", undefined, customerCookie), 200);
  for (const path of [
    "/chatbot/guest-reply", "/messages/conversation/claim", "/messages/conversation/request-staff", "/messages/conversation/assistant-reply",
    `/admin/conversations/${customerThread.conversation.id}/takeover`, `/admin/conversations/${customerThread.conversation.id}/return-to-ai`,
  ]) {
    assert.equal((await call(path, "POST", {}, path.startsWith("/admin") ? adminCookie : customerCookie)).status, 404);
    assert.equal(spec.paths[`/v1${path.replace(customerThread.conversation.id, "{id}")}`], undefined);
  }
  assert.equal((await db.selectFrom("messages").select("id").where("sender_role", "not in", ["customer", "admin"]).execute()).length, 0);
});
