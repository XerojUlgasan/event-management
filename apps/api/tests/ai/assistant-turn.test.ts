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
  assert.equal(prompt.length, 24); // system + 22 stored messages + latest customer
  assert.equal(prompt[1].role, "user");
  assert.equal(prompt[21].role, "assistant");
  assert.equal(prompt[22].role, "assistant");
  assert.match(JSON.stringify(prompt[21]), /AMAC team: history-20/);
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
        body: "Human response",
      })
    ).status,
    201,
  );
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
    }),
    /Conversation not found/,
  );
  await runAssistantTurnService({
    db,
    conversationId: id,
    customerId: customer.id,
    customerMessageId: trigger.id,
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
