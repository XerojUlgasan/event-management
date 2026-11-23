import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Kysely, PostgresDialect } from "kysely";
import { Pool, type QueryResult } from "pg";
import type { DB } from "../../src/db/types.js";
import { finishToolCallData } from "../../src/data/ai/finish-tool-call.js";
import { getLastCatalogToolCallData } from "../../src/data/ai/get-last-catalog-tool-call.js";
import { linkToolCallsToReplyData } from "../../src/data/ai/link-tool-calls-to-reply.js";
import { startToolCallData } from "../../src/data/ai/start-tool-call.js";

const database = `em_ai_tool_calls_${randomUUID().replaceAll("-", "")}`;

const messageEpoch = Date.UTC(2026, 0, 1);

let messageSequence = 0;
let admin: Pool | undefined;
let pool: Pool | undefined;
let db: Kysely<DB>;
let customerId: string;

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
  db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

  const root = new URL("../../prisma/migrations/", import.meta.url);

  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    await pool.query(
      await readFile(new URL(`${entry.name}/migration.sql`, root), "utf8"),
    );

  customerId = (
    await db
      .insertInto("users")
      .values({
        email: `${randomUUID()}@example.test`,
        role: "customer",
        password_hash: "unused",
      })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
});

after(async () => {
  await db?.destroy();

  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
});

async function createConversation() {
  return db
    .insertInto("conversations")
    .values({ customer_id: customerId })
    .returning("id")
    .executeTakeFirstOrThrow();
}

async function createMessage(
  conversationId: string,
  senderRole: "customer" | "assistant",
) {
  const id = randomUUID();
  const senderId = senderRole === "customer" ? customerId : null;
  const createdAt = new Date(messageEpoch + messageSequence++ * 1_000);

  return db
    .insertInto("messages")
    .values({
      id,
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      body: `${senderRole} fixture`,
      created_at: createdAt,
    })
    .returning(["id", "created_at"])
    .executeTakeFirstOrThrow();
}

function startInput(
  turnId: string,
  customerMessageId: string,
  toolCallId = `call_${randomUUID()}`,
) {
  return {
    turnId,
    toolCallId,
    toolName: "searchPublicCatalog",
    customerMessageId,
    input: { catalogType: "package", minPricePesos: 100 },
  };
}

async function databaseError(operation: Promise<unknown>, code: string) {
  await assert.rejects(operation, (error: unknown) => {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === code
    );
  });
}

test("stores several SDK calls per customer and assistant message", async () => {
  const conversation = await createConversation();
  const customerMessage = await createMessage(conversation.id, "customer");
  const turnId = randomUUID();
  const first = await startToolCallData(
    db,
    startInput(turnId, customerMessage.id, "call_first"),
  );
  const second = await startToolCallData(
    db,
    startInput(turnId, customerMessage.id, "call_second"),
  );

  await databaseError(
    startToolCallData(db, startInput(turnId, customerMessage.id, "call_first")),
    "23505",
  );
  const sameCallIdInAnotherTurn = await startToolCallData(
    db,
    startInput(randomUUID(), customerMessage.id, "call_first"),
  );

  assert.notEqual(first.id, second.id);
  assert.notEqual(first.id, sameCallIdInAnotherTurn.id);
  await finishToolCallData(db, {
    id: first.id,
    status: "succeeded",
    output: { items: [{ id: "package-1" }], nextCursor: "cursor-2" },
  });
  await finishToolCallData(db, {
    id: second.id,
    status: "failed",
    errorCode: "ToolTimeout",
  });
  const assistantMessage = await createMessage(conversation.id, "assistant");

  assert.equal(
    await linkToolCallsToReplyData(db, {
      turnId,
      customerMessageId: customerMessage.id,
      assistantMessageId: assistantMessage.id,
    }),
    2n,
  );
  const rows = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("turn_id", "=", turnId)
    .orderBy("tool_call_id")
    .execute();
  assert.deepEqual(
    rows.map(
      ({ status, assistant_message_id: replyId, output, error_code }) => ({
        status,
        replyId,
        output,
        error_code,
      }),
    ),
    [
      {
        status: "succeeded",
        replyId: assistantMessage.id,
        output: { items: [{ id: "package-1" }], nextCursor: "cursor-2" },
        error_code: null,
      },
      {
        status: "failed",
        replyId: assistantMessage.id,
        output: null,
        error_code: "ToolTimeout",
      },
    ],
  );
  await assert.rejects(
    finishToolCallData(db, {
      id: first.id,
      status: "failed",
      errorCode: "Retry",
    }),
    /already completed/,
  );

  await db
    .deleteFrom("messages")
    .where("id", "=", assistantMessage.id)
    .execute();
  const afterReplyDelete = await db
    .selectFrom("ai_tool_calls")
    .select("assistant_message_id")
    .where("turn_id", "=", turnId)
    .execute();
  assert.deepEqual(afterReplyDelete, [
    { assistant_message_id: null },
    { assistant_message_id: null },
  ]);

  await db
    .deleteFrom("messages")
    .where("id", "=", customerMessage.id)
    .execute();
  assert.equal(
    await db
      .selectFrom("ai_tool_calls")
      .select("id")
      .where("turn_id", "=", turnId)
      .executeTakeFirst(),
    undefined,
  );
});

test("requires customer triggers and same-conversation assistant replies", async () => {
  const firstConversation = await createConversation();
  const secondConversation = await createConversation();
  const customerMessage = await createMessage(firstConversation.id, "customer");
  const sameConversationAssistant = await createMessage(
    firstConversation.id,
    "assistant",
  );
  const otherConversationAssistant = await createMessage(
    secondConversation.id,
    "assistant",
  );

  await databaseError(
    startToolCallData(
      db,
      startInput(randomUUID(), sameConversationAssistant.id),
    ),
    "23514",
  );

  const turnId = randomUUID();
  const call = await startToolCallData(
    db,
    startInput(turnId, customerMessage.id),
  );
  await finishToolCallData(db, {
    id: call.id,
    status: "succeeded",
    output: {},
  });
  await databaseError(
    linkToolCallsToReplyData(db, {
      turnId,
      customerMessageId: customerMessage.id,
      assistantMessageId: otherConversationAssistant.id,
    }),
    "23514",
  );
  await databaseError(
    linkToolCallsToReplyData(db, {
      turnId,
      customerMessageId: customerMessage.id,
      assistantMessageId: customerMessage.id,
    }),
    "23514",
  );
  assert.equal(
    await linkToolCallsToReplyData(db, {
      turnId,
      customerMessageId: customerMessage.id,
      assistantMessageId: sameConversationAssistant.id,
    }),
    1n,
  );
});

test("conversation deletion removes calls while deleting linked messages", async () => {
  const conversation = await createConversation();
  const customerMessage = await createMessage(conversation.id, "customer");
  const turnId = randomUUID();
  const call = await startToolCallData(
    db,
    startInput(turnId, customerMessage.id),
  );
  await finishToolCallData(db, {
    id: call.id,
    status: "succeeded",
    output: { items: [] },
  });
  const assistantMessage = await createMessage(conversation.id, "assistant");
  await linkToolCallsToReplyData(db, {
    turnId,
    customerMessageId: customerMessage.id,
    assistantMessageId: assistantMessage.id,
  });

  await db
    .deleteFrom("conversations")
    .where("id", "=", conversation.id)
    .execute();

  assert.equal(
    await db
      .selectFrom("ai_tool_calls")
      .select("id")
      .where("id", "=", call.id)
      .executeTakeFirst(),
    undefined,
  );
});

test("bounds JSON and keeps failed error details sanitized", async () => {
  const conversation = await createConversation();
  const customerMessage = await createMessage(conversation.id, "customer");
  const turnId = randomUUID();

  await assert.rejects(
    startToolCallData(db, {
      ...startInput(turnId, customerMessage.id),
      input: "not an object",
    }),
    /input is invalid or too large/,
  );
  await assert.rejects(
    startToolCallData(db, {
      ...startInput(turnId, customerMessage.id),
      input: { query: "x".repeat(70_000) },
    }),
    /input is invalid or too large/,
  );

  const call = await startToolCallData(
    db,
    startInput(turnId, customerMessage.id),
  );
  await assert.rejects(
    finishToolCallData(db, {
      id: call.id,
      status: "succeeded",
      output: { text: "x".repeat(70_000) },
    }),
    /output is invalid or too large/,
  );
  await assert.rejects(
    finishToolCallData(db, {
      id: call.id,
      status: "failed",
      errorCode: "Provider failure: private response body",
    }),
    /completion is invalid/,
  );
  const row = await db
    .selectFrom("ai_tool_calls")
    .select(["status", "output", "error_code"])
    .where("id", "=", call.id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(row, { status: "started", output: null, error_code: null });
});

test("returns only the last earlier replied catalog search in this conversation", async () => {
  const conversation = await createConversation();
  const otherConversation = await createConversation();

  const firstCustomer = await createMessage(conversation.id, "customer");
  const firstTurnId = randomUUID();
  const firstCall = await startToolCallData(
    db,
    startInput(firstTurnId, firstCustomer.id, "search-first"),
  );
  await finishToolCallData(db, {
    id: firstCall.id,
    status: "succeeded",
    output: { items: [{ id: "old" }], nextCursor: "cursor-old" },
  });
  const firstReply = await createMessage(conversation.id, "assistant");
  await linkToolCallsToReplyData(db, {
    turnId: firstTurnId,
    customerMessageId: firstCustomer.id,
    assistantMessageId: firstReply.id,
  });

  const noReplyCustomer = await createMessage(conversation.id, "customer");
  const noReplyCall = await startToolCallData(
    db,
    startInput(randomUUID(), noReplyCustomer.id, "search-no-reply"),
  );
  await finishToolCallData(db, {
    id: noReplyCall.id,
    status: "succeeded",
    output: { items: [{ id: "unreplied" }], nextCursor: "cursor-unreplied" },
  });

  const currentCustomer = await createMessage(conversation.id, "customer");
  const currentTurnId = randomUUID();
  const currentCall = await startToolCallData(
    db,
    startInput(currentTurnId, currentCustomer.id, "search-current"),
  );
  await finishToolCallData(db, {
    id: currentCall.id,
    status: "succeeded",
    output: { items: [{ id: "current" }], nextCursor: "cursor-current" },
  });

  const beforeCurrentReply = await getLastCatalogToolCallData(db, {
    toolName: "searchPublicCatalog",
    conversationId: conversation.id,
    customerMessageId: currentCustomer.id,
  });
  assert.ok(beforeCurrentReply);
  assert.ok(beforeCurrentReply.replyOrder.endsWith(firstReply.id));
  const { replyOrder: _replyOrder, ...earlierSearch } = beforeCurrentReply;
  assert.deepEqual(earlierSearch, {
    triggerMessageId: firstCustomer.id,
    replyId: firstReply.id,
    replyBody: "assistant fixture",
    input: { catalogType: "package", minPricePesos: 100 },
    output: { items: [{ id: "old" }], nextCursor: "cursor-old" },
  });

  const currentReply = await createMessage(conversation.id, "assistant");
  await linkToolCallsToReplyData(db, {
    turnId: currentTurnId,
    customerMessageId: currentCustomer.id,
    assistantMessageId: currentReply.id,
  });

  const otherCustomer = await createMessage(otherConversation.id, "customer");
  const otherTurnId = randomUUID();
  const otherCall = await startToolCallData(
    db,
    startInput(otherTurnId, otherCustomer.id, "search-other-conversation"),
  );
  await finishToolCallData(db, {
    id: otherCall.id,
    status: "succeeded",
    output: { items: [{ id: "other" }], nextCursor: "cursor-other" },
  });
  const otherReply = await createMessage(otherConversation.id, "assistant");
  await linkToolCallsToReplyData(db, {
    turnId: otherTurnId,
    customerMessageId: otherCustomer.id,
    assistantMessageId: otherReply.id,
  });

  assert.deepEqual(
    await getLastCatalogToolCallData(db, {
      toolName: "searchPublicCatalog",
      conversationId: conversation.id,
      customerMessageId: currentCustomer.id,
    }),
    beforeCurrentReply,
  );
  assert.equal(
    await getLastCatalogToolCallData(db, {
      toolName: "searchPublicCatalog",
      conversationId: conversation.id,
      customerMessageId: otherCustomer.id,
    }),
    undefined,
  );
  assert.equal(
    await getLastCatalogToolCallData(db, {
      toolName: "searchPublicCatalog",
      conversationId: conversation.id,
      customerMessageId: currentReply.id,
    }),
    undefined,
  );
});

test("enables RLS and denies client-role table privileges", async () => {
  const queryPool = pool;
  assert.ok(queryPool);
  const relation = await queryPool.query<{
    row_security: boolean;
    public_privileges: string[];
  }>(`
    SELECT relation.relrowsecurity AS row_security,
      COALESCE(
        array_agg(DISTINCT acl.privilege_type) FILTER (WHERE acl.grantee = 0),
        ARRAY[]::text[]
      ) AS public_privileges
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    LEFT JOIN LATERAL aclexplode(
      COALESCE(relation.relacl, acldefault('r', relation.relowner))
    ) AS acl ON true
    WHERE namespace.nspname = 'public' AND relation.relname = 'ai_tool_calls'
    GROUP BY relation.relrowsecurity
  `);
  assert.equal(relation.rows[0]?.row_security, true);
  assert.deepEqual(relation.rows[0]?.public_privileges, []);

  const roles = await queryPool.query<{ rolname: string }>(
    "SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[])",
    [["anon", "authenticated"]],
  );

  for (const { rolname } of roles.rows) {
    const roleAccess: QueryResult<{ has_privilege: boolean }> =
      await queryPool.query(
        "SELECT has_table_privilege($1, 'public.ai_tool_calls', 'SELECT,INSERT,UPDATE,DELETE') AS has_privilege",
        [rolname],
      );
    assert.equal(roleAccess.rows[0]?.has_privilege, false, `${rolname} access`);
  }
});

test("ordinal choices correspond to the links that appeared in the delivered answer", async () => {
  const { buildPreviousCatalogSearchContext } =
    await import("../../src/services/ai/assistant-context.js");
  const thread = await createConversation();
  const query = await createMessage(thread.id, "customer");
  const turnId = randomUUID();

  const candidates = ["first", "hidden", "third"].map((name) => ({
    id: randomUUID(),
    name,
    type: "package",
    url: "/packages/" + name,
    privateField: "ignore",
  }));

  for (const items of [candidates.slice(0, 2), candidates.slice(2)]) {
    const call = await startToolCallData(db, startInput(turnId, query.id));
    await finishToolCallData(db, {
      id: call.id,
      status: "succeeded",
      output: { results: items, nextCursor: null },
    });
  }

  const reply = await createMessage(thread.id, "assistant");
  await db
    .updateTable("messages")
    .set({ body: "1. [Third](/packages/third)\n2. [First](/packages/first)" })
    .where("id", "=", reply.id)
    .execute();
  await linkToolCallsToReplyData(db, {
    turnId,
    customerMessageId: query.id,
    assistantMessageId: reply.id,
  });
  const next = await createMessage(thread.id, "customer");
  const context = await buildPreviousCatalogSearchContext({
    db,
    conversationId: thread.id,
    customerMessageId: next.id,
  });
  assert.deepEqual(
    context?.shownItems?.map((item) => item.name),
    ["third", "first"],
  );
  assert.equal(context?.shownItems?.[1]?.id, candidates[0]?.id);
  assert.doesNotMatch(
    JSON.stringify(context?.shownItems),
    /privateField|hidden/,
  );
});

test("the most recently displayed recommendations win when earlier turns finish late", async () => {
  const { buildPreviousCatalogRecommendationsContext } =
    await import("../../src/services/ai/assistant-context.js");
  const thread = await createConversation();
  const earlyQuestion = await createMessage(thread.id, "customer");
  const lateQuestion = await createMessage(thread.id, "customer");
  const fastReply = await createMessage(thread.id, "assistant");
  const slowReply = await createMessage(thread.id, "assistant");

  for (const [question, reply] of [
    [earlyQuestion, slowReply],
    [lateQuestion, fastReply],
  ]) {
    const turnId = randomUUID();
    const lookup = await startToolCallData(db, {
      ...startInput(turnId, question.id),
      toolName: "attachCatalogRecommendations",
    });
    await finishToolCallData(db, { id: lookup.id, status: "succeeded" });
    await db
      .updateTable("messages")
      .set({
        catalog_recommendations: JSON.stringify([
          {
            id: reply.id,
            type: "service",
            slug: "fixture-service",
            name: "Fixture service",
            description: "",
            imageUrl: null,
            fixedPricePesos: null,
            hourlyRatePesos: 1200,
            includedHours: null,
          },
        ]),
      })
      .where("id", "=", reply.id)
      .execute();
    await linkToolCallsToReplyData(db, {
      turnId,
      customerMessageId: question.id,
      assistantMessageId: reply.id,
    });
  }

  const followUp = await createMessage(thread.id, "customer");
  const context = await buildPreviousCatalogRecommendationsContext({
    db,
    conversationId: thread.id,
    customerMessageId: followUp.id,
  });
  assert.equal(context?.replyId, slowReply.id);
  assert.equal(context?.shownItems[0]?.id, slowReply.id);
});
