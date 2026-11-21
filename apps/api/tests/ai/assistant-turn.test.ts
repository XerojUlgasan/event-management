import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Pool } from "pg";
import { sql } from "kysely";
import { MockLanguageModelV4, MockProviderV4 } from "ai/test";
import type {
  Quotation,
  QuotationPreparation,
} from "@event-management/contracts/quotations";
import {
  customerMessageResultSchema,
  threadSchema,
  conversationsSchema,
} from "../../src/controllers/messages/schemas.js";
import { hashSessionToken } from "../../src/utils/session.js";
import { startToolCallData } from "../../src/data/ai/start-tool-call.js";
import { requestHumanHandoffService } from "../../src/services/ai/request-human-handoff.js";
import { humanHandoffAcknowledgement } from "../../src/data/messages/request-human-handoff.js";
import { runAssistantTurnService } from "../../src/services/ai/run-assistant-turn.js";
import { getMyProposalService } from "../../src/services/ai/get-my-proposal.js";

const database = `em_ai_test_${randomUUID().replaceAll("-", "")}`;

const modelId = "fixture/text-model";
const liveModelId = process.env.TEXT_MODEL;
const liveGatewayKey = process.env.AI_GATEWAY_API_KEY;
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

function useCatalogCalls(
  inputs: Record<string, unknown>[],
  beforeAnswer?: () => Promise<void>,
) {
  useToolCalls(
    inputs.map((input) => ({ toolName: "searchPublicCatalog", input })),
    beforeAnswer,
  );
}

function useToolCalls(
  calls: {
    toolName:
      | "searchPublicCatalog"
      | "getPublicCatalogItem"
      | "getMyProposal"
      | "getMySentQuotation"
      | "getMyRequestHistory"
      | "requestHumanHandoff"
      | "updateConversationMemory";
    input: Record<string, unknown>;
  }[],
  beforeAnswer?: () => Promise<void>,
) {
  useReply("Catalog results are ready");
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);

    if (model.doGenerateCalls.length === 1)
      return {
        ...result,
        content: calls.map(({ toolName, input }, index) => ({
          type: "tool-call" as const,
          toolCallId: `catalog-call-${index}`,
          toolName,
          input: JSON.stringify(input),
        })),
        finishReason: { unified: "tool-calls" as const, raw: undefined },
      };

    await beforeAnswer?.();

    return result;
  };
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
    // pg-pool's end promise can settle before its clients' socket-end callbacks.
    // A normal drop lets those disconnects finish and exposes a genuine leak;
    // FORCE can terminate a closing client and emit a late unhandled error.
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
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

test("concurrent customer retries start only one assistant turn", async () => {
  useReply("One reply");
  const id = await conversation();
  const requestId = randomUUID();
  const payload = { conversationId: id, body: "Please help", requestId };
  const responses = await Promise.all([
    call("/messages/conversation/messages", customer.cookie, payload),
    call("/messages/conversation/messages", customer.cookie, payload),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status),
    [201, 201],
  );

  const results = await Promise.all(
    responses.map(async (response) =>
      customerMessageResultSchema.parse(await response.json()),
    ),
  );

  assert.deepEqual(
    results.map((result) => result.message.id),
    [requestId, requestId],
  );
  assert.equal(
    results.filter((result) => result.assistantMessage?.body === "One reply")
      .length,
    1,
  );
  assert.equal(
    results.filter(
      (result) =>
        result.assistantMessage === null && result.assistantError === null,
    ).length,
    1,
  );
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(results[0].message.processing, null);
  assert.equal(
    (
      await db
        .selectFrom("background_jobs")
        .select("id")
        .where("dedupe_key", "=", requestId)
        .execute()
    ).length,
    0,
  );
  const messages = await db
    .selectFrom("messages")
    .select("sender_role")
    .where("conversation_id", "=", id)
    .execute();
  assert.equal(
    messages.filter((message) => message.sender_role === "customer").length,
    1,
  );
  assert.equal(
    messages.filter((message) => message.sender_role === "assistant").length,
    1,
  );
});

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
  assert.deepEqual(await off.json(), {
    aiEnabled: false,
    aiVersion: 1,
    aiHandoff: null,
  });
  const noop = await setAi(id, false, 1);
  assert.equal(noop.status, 200);
  assert.deepEqual(await noop.json(), {
    aiEnabled: false,
    aiVersion: 1,
    aiHandoff: null,
  });
  assert.equal((await setAi(id, true, 0)).status, 409);

  const held = await send(id, "A human can answer this");
  assert.equal(held.assistantMessage, null);
  assert.equal(held.assistantError, null);
  assert.equal(model.doGenerateCalls.length, 0);
  const reopened = await send(id, "Continue with the human team");
  assert.equal(reopened.assistantMessage, null);
  assert.equal(reopened.assistantError, null);
  assert.equal(model.doGenerateCalls.length, 0);
  const reopenedConversation = await db
    .selectFrom("conversations")
    .select(["ai_enabled", "ai_version"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(reopenedConversation, {
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
  assert.deepEqual(await on.json(), {
    aiEnabled: true,
    aiVersion: 2,
    aiHandoff: null,
  });
  assert.equal(model.doGenerateCalls.length, 0);
  const answered = await send(id, "Now please answer");
  assert.equal(answered.assistantMessage?.body, "AI is back");
  assert.equal(answered.assistantError, null);
  assert.equal(model.doGenerateCalls.length, 1);

  assert.equal((await setAi(id, false, 2)).status, 200);
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
    assert.deepEqual(await on.json(), {
      aiEnabled: true,
      aiVersion: 2,
      aiHandoff: null,
    });
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
  const message = model.doGenerateCalls[callIndex].prompt.find(
    (item) =>
      item.role === "user" &&
      JSON.stringify(item.content).includes(
        "Current server-built context snapshot",
      ),
  );

  assert.ok(message);
  assert.equal(message.role, "user");
  assert.equal(message.content.length, 1);
  const part = message.content[0];
  assert.equal(part.type, "text");
  const context: unknown = JSON.parse(part.text.slice(part.text.indexOf("{")));
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

async function bookingFactsConversation() {
  const bookingId = await booking(customer.id, `AI-FACTS-${randomUUID()}`);
  const id = await conversation();
  await db
    .updateTable("conversations")
    .set({ booking_request_id: bookingId })
    .where("id", "=", id)
    .executeTakeFirstOrThrow();

  return { id, bookingId };
}

async function deliverBookingFactQuotation(
  bookingId: string,
  id: string,
  description: string,
  amountMinor: number,
) {
  const path = `/admin/booking-requests/${bookingId}/quotations`;
  const preparationResponse = await call(`${path}/prepare`, team.cookie);
  assert.equal(preparationResponse.status, 200);
  const { preparation }: { preparation: QuotationPreparation } =
    await preparationResponse.json();
  const {
    expectedBookingUpdatedAt,
    packageId,
    expectedPackageUpdatedAt,
    currentOffer,
  } = preparation;
  const response = await call(`${path}/send`, team.cookie, {
    requestId: randomUUID(),
    expectedBookingUpdatedAt,
    packageId,
    expectedPackageUpdatedAt,
    currentOffer,
    revisionReason: currentOffer ? "Quotation revision fixture reason" : null,
    items: [
      {
        id: randomUUID(),
        direction: "add",
        kind: "addition",
        description,
        amountMinor,
        serviceId: null,
      },
    ],
  });
  assert.equal(response.status, 200, await response.clone().text());
  const { quotation }: { quotation: Quotation } = await response.json();
  const state = await db
    .selectFrom("conversations")
    .select(["ai_enabled", "ai_version"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(state.ai_enabled, false);
  assert.equal((await setAi(id, true, state.ai_version)).status, 200);

  return quotation;
}

async function updateBookingFactStatus(
  bookingId: string,
  status: "needs_details" | "accepted",
  reason: string,
) {
  const response = await app.request(
    `/v1/admin/booking-requests/${bookingId}/status`,
    {
      method: "PATCH",
      headers: { Cookie: team.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    },
  );
  assert.equal(response.status, 200);
}

async function assertBookingFactAudit(
  result: Awaited<ReturnType<typeof send>>,
  toolName: "getMySentQuotation" | "getMyRequestHistory",
  expectedOutput: Record<string, unknown>,
) {
  assert.equal(result.assistantError, null);
  assert.ok(result.assistantMessage);
  const records = await db
    .selectFrom("ai_tool_calls")
    .select([
      "status",
      "tool_call_id",
      "turn_id",
      "input",
      "output",
      "error_code",
      "completed_at",
      "assistant_message_id",
    ])
    .where("customer_message_id", "=", result.message.id)
    .where("tool_name", "=", toolName)
    .execute();
  assert.ok(
    records.length > 0,
    `Missing ${toolName} audit. Fixture reply: ${result.assistantMessage.body}`,
  );

  for (const record of records) {
    assert.equal(record.status, "succeeded");
    assert.deepEqual(record.input, {});
    assert.ok(record.completed_at);
    assert.ok(record.tool_call_id);
    assert.equal(record.error_code, null);
    assert.equal(record.assistant_message_id, result.assistantMessage.id);
    assert.deepEqual(record.output, expectedOutput);
  }

  return result.assistantMessage.body;
}

async function latestBookingStatusTimestamp(bookingId: string) {
  const row = await db
    .selectFrom("booking_request_status_history")
    .select("created_at")
    .where("booking_request_id", "=", bookingId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .executeTakeFirstOrThrow();

  return row.created_at.toISOString();
}

function bookingFactToolOutput(
  toolName: "getMySentQuotation" | "getMyRequestHistory",
) {
  const answerStep = model.doGenerateCalls[1];

  for (const message of answerStep.prompt) {
    if (message.role !== "tool") continue;

    for (const part of message.content) {
      if (part.type !== "tool-result" || part.toolName !== toolName) continue;

      assert.equal(part.output.type, "json");

      return part.output.value;
    }
  }

  assert.fail(`Missing model evidence for ${toolName}`);
}

test("quotation follow-up gets the latest delivered version only and audits the read", async () => {
  const { id, bookingId } = await bookingFactsConversation();
  const toolName = "getMySentQuotation";
  const first = await deliverBookingFactQuotation(
    bookingId,
    id,
    "Old transport fee",
    27500,
  );

  useToolCalls([{ toolName, input: {} }]);
  const original = await send(id, "What was the total of my sent quotation?");
  await assertBookingFactAudit(original, toolName, {
    status: "found",
    version: first.version,
    sentAt: first.sentAt,
  });

  const latest = await deliverBookingFactQuotation(
    bookingId,
    id,
    "Garden lighting",
    87542,
  );
  await db
    .insertInto("quotations")
    .values({
      booking_request_id: bookingId,
      version: latest.version + 1,
      base_amount_minor: 999000,
      total_amount_minor: 999000,
      created_by: team.id,
      offered_package_id: packageId,
      status: "draft",
    })
    .execute();
  useToolCalls([{ toolName, input: {} }]);
  const revised = await send(
    id,
    "And what's the total now, including the extra charge?",
  );

  assert.deepEqual(bookingFactToolOutput(toolName), {
    status: "found",
    quotation: {
      version: latest.version,
      currency: "PHP",
      baseAmountPesos: 1000,
      totalAmountPesos: 1875.42,
      sentAt: latest.sentAt,
      items: [
        {
          kind: "addition",
          direction: "add",
          description: "Garden lighting",
          amountPesos: 875.42,
        },
      ],
    },
  });
  await assertBookingFactAudit(revised, toolName, {
    status: "found",
    version: latest.version,
    sentAt: latest.sentAt,
  });
});

test("status follow-up gets only the latest change and audits it without the reason", async () => {
  const { id, bookingId } = await bookingFactsConversation();
  const toolName = "getMyRequestHistory";
  const reason = "Please send your reception start time.";
  await updateBookingFactStatus(bookingId, "needs_details", reason);
  useToolCalls([{ toolName, input: {} }]);
  const original = await send(id, "Why does it say Needs details?");
  const firstChange = await latestBookingStatusTimestamp(bookingId);
  assert.deepEqual(bookingFactToolOutput(toolName), {
    status: "found",
    latestChange: { status: "needs_details", reason, createdAt: firstChange },
  });
  await assertBookingFactAudit(original, toolName, {
    status: "found",
    requestStatus: "needs_details",
    changedAt: firstChange,
  });

  const latestReason = "The venue layout was reviewed.";
  useToolCalls([{ toolName, input: {} }]);
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (options) => {
    if (model.doGenerateCalls.length === 0)
      await updateBookingFactStatus(bookingId, "accepted", latestReason);

    return generate(options);
  };
  const updated = await send(id, "And why did the request status change now?");
  assert.match(
    JSON.stringify(turnContext(0).context),
    /"status":"needs_details"/,
  );
  const latestChange = await latestBookingStatusTimestamp(bookingId);
  assert.deepEqual(bookingFactToolOutput(toolName), {
    status: "found",
    latestChange: {
      status: "accepted",
      reason: latestReason,
      createdAt: latestChange,
    },
  });
  await assertBookingFactAudit(updated, toolName, {
    status: "found",
    requestStatus: "accepted",
    changedAt: latestChange,
  });
});

test("booking reads distinguish unlinked, unsent, and missing status history", async () => {
  const unlinked = await conversation();
  const linked = await bookingFactsConversation();
  const calls = [
    { toolName: "getMySentQuotation", input: {} },
    { toolName: "getMyRequestHistory", input: {} },
  ] as const;

  for (const { id, statuses } of [
    { id: unlinked, statuses: ["no_linked_request", "no_linked_request"] },
    { id: linked.id, statuses: ["no_sent_quotation", "no_status_history"] },
  ]) {
    useToolCalls([...calls]);
    const result = await send(
      id,
      "What's my latest quotation and when did my inquiry status change?",
    );

    for (const [index, { toolName }] of calls.entries()) {
      const expected = { status: statuses[index] };
      assert.deepEqual(bookingFactToolOutput(toolName), expected);
      await assertBookingFactAudit(result, toolName, expected);
    }
  }
});

test(
  "live AMAC model rereads the quotation and status after they change",
  { skip: process.env.AMAC_LIVE_TOOL_TESTS !== "1" },
  async () => {
    assert.ok(
      liveModelId && liveGatewayKey,
      "Configure the live AMAC text model and Gateway key",
    );
    const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
    process.env.TEXT_MODEL = liveModelId;
    process.env.AI_GATEWAY_API_KEY = liveGatewayKey;
    delete globalThis.AI_SDK_DEFAULT_PROVIDER;

    try {
      const { id, bookingId } = await bookingFactsConversation();
      const first = await deliverBookingFactQuotation(
        bookingId,
        id,
        "Transport",
        27500,
      );
      const firstReply = await assertBookingFactAudit(
        await send(id, "What is the total on the quotation AMAC sent me?"),
        "getMySentQuotation",
        { status: "found", version: first.version, sentAt: first.sentAt },
      );
      assert.match(firstReply, /(?<![\d,])1,?275(?!\d|,\d|\.\d*[1-9])/);
      assert.match(firstReply, /₱|\bPHP\b|\bpesos?\b/i);

      const latest = await deliverBookingFactQuotation(
        bookingId,
        id,
        "Garden lighting",
        87542,
      );
      const revisedReply = await assertBookingFactAudit(
        await send(
          id,
          "And what's the total now, and what is the extra charge for?",
        ),
        "getMySentQuotation",
        { status: "found", version: latest.version, sentAt: latest.sentAt },
      );
      const revisedTotal = /(?<![\d,])1,?875\.42(?!\d)/;
      const historical = /\b(?:earlier|previous|prior|older|version 1)\b/i;
      const lines = revisedReply.split("\n");
      assert.ok(
        lines.some(
          (line) =>
            revisedTotal.test(line) &&
            /\btotal(?:s)?\b/i.test(line) &&
            !historical.test(line),
        ),
        `Expected the revised amount as the current total. Fixture reply: ${revisedReply}`,
      );
      assert.match(revisedReply, /₱|\bPHP\b|\bpesos?\b/i);
      assert.match(revisedReply, /garden lighting/i);

      // The tool result excludes older offers. The saved chat still contains
      // the first answer, which the live model may acknowledge as historical.
      for (const paragraph of revisedReply.split(/\n\s*\n/)) {
        if (/1,?275|\btransport\b/i.test(paragraph))
          assert.match(paragraph, historical);
      }

      await updateBookingFactStatus(
        bookingId,
        "needs_details",
        "Please provide the reception start time.",
      );
      const statusReply = await assertBookingFactAudit(
        await send(id, "It says Needs details. What does AMAC need from me?"),
        "getMyRequestHistory",
        {
          status: "found",
          requestStatus: "needs_details",
          changedAt: await latestBookingStatusTimestamp(bookingId),
        },
      );
      assert.match(statusReply, /(?:reception|start).{0,35}time/i);

      await updateBookingFactStatus(
        bookingId,
        "accepted",
        "The venue layout was reviewed.",
      );
      const updatedReply = await assertBookingFactAudit(
        await send(id, "I see it changed again. What was the latest reason?"),
        "getMyRequestHistory",
        {
          status: "found",
          requestStatus: "accepted",
          changedAt: await latestBookingStatusTimestamp(bookingId),
        },
      );
      assert.match(updatedReply, /venue layout/i);
      assert.doesNotMatch(updatedReply, /reception start time/i);
    } finally {
      process.env.TEXT_MODEL = modelId;
      process.env.AI_GATEWAY_API_KEY = "fixture-key";
      globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider;
    }
  },
);

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
    JSON.stringify(model.doGenerateCalls[1].prompt),
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
  assert.equal(prompt[21].role, "assistant");
  assert.equal(prompt[22].role, "assistant");
  assert.match(JSON.stringify(prompt[21]), /AMAC team: history-20/);
  assert.match(JSON.stringify(prompt[22]), /unverified historical claims/);
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

test("unauthorized sends fail before generation, and admin messages do not trigger AI", async () => {
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

test("multiple searches belong to one customer turn and one resulting reply without replaying them", async () => {
  useCatalogCalls([
    { catalogType: "package", maxPricePesos: 10000, pax: 80 },
    { catalogType: "service", pricingType: "hourly", maxPricePesos: 3000 },
  ]);
  const id = await conversation();
  const requestId = randomUUID();
  const payload = {
    conversationId: id,
    body: "Find packages and services",
    requestId,
  };
  const result = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, payload)
    ).json(),
  );
  assert.equal(result.assistantError, null);
  assert.ok(result.assistantMessage);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", requestId)
    .orderBy("tool_call_id")
    .execute();
  assert.equal(calls.length, 2);
  assert.equal(new Set(calls.map((item) => item.id)).size, 2);
  assert.equal(new Set(calls.map((item) => item.turn_id)).size, 1);
  assert.deepEqual(
    calls.map((item) => item.tool_call_id),
    ["catalog-call-0", "catalog-call-1"],
  );
  assert.ok(
    calls.every(
      (item) =>
        item.tool_name === "searchPublicCatalog" &&
        item.status === "succeeded" &&
        item.assistant_message_id === result.assistantMessage?.id &&
        item.completed_at !== null &&
        item.error_code === null,
    ),
  );
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /tool-result/);
  const replay = await call(
    "/messages/conversation/messages",
    customer.cookie,
    payload,
  );
  assert.equal(replay.status, 201);
  assert.equal(model.doGenerateCalls.length, 2);
  assert.equal(
    (
      await db
        .selectFrom("ai_tool_calls")
        .select("id")
        .where("customer_message_id", "=", requestId)
        .execute()
    ).length,
    2,
  );
});

async function detailPackage() {
  const marker = randomUUID();
  const row = await db
    .insertInto("packages")
    .values({
      name: `Detail fixture ${marker}`,
      slug: `detail-${marker}`,
      description: "detail-source-marker",
      price: 1250,
      max_guests: 80,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return row.id;
}

test("catalog detail reaches the model as Markdown and links its audit record to the reply", async () => {
  const id = await detailPackage();
  useToolCalls([
    { toolName: "getPublicCatalogItem", input: { catalogType: "package", id } },
  ]);
  const result = await send(await conversation(), "Describe this package");
  assert.equal(result.assistantError, null);
  assert.ok(result.assistantMessage);

  const toolMessage = model.doGenerateCalls[1].prompt.find(
    (message) => message.role === "tool",
  );

  assert.ok(toolMessage);

  const part = toolMessage.content.find(
    (item) =>
      item.type === "tool-result" && item.toolName === "getPublicCatalogItem",
  );

  assert.ok(part && part.type === "tool-result");
  assert.equal(part.output.type, "text");

  if (part.output.type !== "text")
    throw new Error("Expected Markdown tool output");

  assert.match(part.output.value, /^# Detail fixture/);
  assert.match(part.output.value, /detail-source-marker/);
  assert.match(part.output.value, /PHP 1250 per package/);
  const record = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(record.tool_name, "getPublicCatalogItem");
  assert.equal(record.status, "succeeded");
  assert.equal(record.assistant_message_id, result.assistantMessage.id);
  assert.deepEqual(record.output, {
    markdown: part.output.value,
    nextCursor: null,
  });
});

test("catalog detail failures hide private records and sanitize errors", async () => {
  useToolCalls([
    {
      toolName: "getPublicCatalogItem",
      input: { catalogType: "package", id: randomUUID() },
    },
    {
      toolName: "getPublicCatalogItem",
      input: { catalogType: "package", id: packageId, cursor: "invalid" },
    },
  ]);
  const result = await send(await conversation(), "Read unavailable details");
  assert.ok(result.assistantMessage);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .orderBy("tool_call_id")
    .execute();
  assert.deepEqual(
    calls.map((item) => item.error_code),
    ["item_not_found", "invalid_cursor"],
  );
  assert.ok(
    calls.every((item) => item.status === "failed" && item.output === null),
  );
  const prompt = JSON.stringify(model.doGenerateCalls[1].prompt);
  assert.match(prompt, /unavailable or no longer public/);
  assert.match(prompt, /without a cursor/);
  assert.doesNotMatch(prompt, /HTTPException|postgres|password|stack/i);
});

test("catalog and proposal tools share the existing six-operation turn budget", async () => {
  const id = await detailPackage();
  useToolCalls(
    Array.from({ length: 7 }, (_, index) =>
      index % 3 === 2
        ? { toolName: "getMyProposal", input: {} }
        : index % 3 === 1
          ? {
              toolName: "getPublicCatalogItem",
              input: { catalogType: "package", id },
            }
          : {
              toolName: "searchPublicCatalog",
              input: { catalogType: "package" },
            },
    ),
  );
  const result = await send(
    await conversation(),
    "Find packages and read details",
  );
  assert.ok(result.assistantMessage);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.filter((item) => item.status === "succeeded").length, 6);
  assert.equal(
    calls.filter((item) => item.error_code === "call_limit").length,
    1,
  );
  assert.equal(new Set(calls.map((item) => item.tool_name)).size, 3);
});

test("takeover after catalog detail keeps its record and suppresses the reply", async () => {
  const id = await conversation();
  useToolCalls(
    [
      {
        toolName: "getPublicCatalogItem",
        input: { catalogType: "package", id: await detailPackage() },
      },
    ],
    async () => {
      const response = await call(
        `/admin/conversations/${id}/messages`,
        team.cookie,
        { body: "Taking over detail discussion" },
      );
      assert.equal(response.status, 201);
    },
  );
  const result = await send(id, "Explain this package");
  assert.equal(result.assistantMessage, null);
  assert.equal(result.assistantError, null);
  const record = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(record.status, "succeeded");
  assert.equal(record.assistant_message_id, null);
});

test("catalog detail cannot receive model-selected conversation scope", async () => {
  useToolCalls([
    {
      toolName: "getPublicCatalogItem",
      input: {
        catalogType: "package",
        id: packageId,
        conversationId: randomUUID(),
      },
    },
  ]);
  const result = await send(
    await conversation(),
    "Read details in another conversation",
  );
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.length, 0);
});

test("failed searches record sanitized errors and distinguish unavailable from empty results", async () => {
  useCatalogCalls([{ catalogType: "package", cursor: "invalid" }]);
  const id = await conversation();
  const result = await send(id, "Find more packages");
  assert.ok(result.assistantMessage);
  const call = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(call.status, "failed");
  assert.equal(call.output, null);
  assert.equal(call.error_code, "search_unavailable");
  assert.equal(call.assistant_message_id, result.assistantMessage.id);
  const prompt = JSON.stringify(model.doGenerateCalls[1].prompt);
  assert.match(prompt, /search is unavailable/);
  assert.doesNotMatch(
    prompt,
    /Invalid pagination cursor|HTTPException|postgres|password/i,
  );
});

test("tool records survive provider failure without a resulting assistant message", async () => {
  useCatalogCalls([{ catalogType: "package" }], async () => {
    throw new Error("private-provider-payload-after-tool");
  });
  const id = await conversation();
  const result = await send(id, "Find a package");
  assert.equal(result.assistantMessage, null);
  assert.ok(result.assistantError);
  assert.doesNotMatch(JSON.stringify(result), /private-provider-payload/);
  const call = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(call.status, "succeeded");
  assert.equal(call.assistant_message_id, null);
});

test("human takeover after a search preserves its audit record and suppresses the reply", async () => {
  const id = await conversation();
  useCatalogCalls([{ catalogType: "package" }], async () => {
    const response = await call(
      `/admin/conversations/${id}/messages`,
      team.cookie,
      { body: "The team will handle this" },
    );
    assert.equal(response.status, 201);
  });
  const result = await send(id, "Find a package before takeover");
  assert.equal(result.assistantMessage, null);
  assert.equal(result.assistantError, null);
  const record = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(record.status, "succeeded");
  assert.equal(record.assistant_message_id, null);
});

test("turn tool budget bounds execution and records rejected calls", async () => {
  useCatalogCalls(
    Array.from({ length: 7 }, () => ({ catalogType: "package" })),
  );
  const result = await send(await conversation(), "Compare several searches");
  assert.ok(result.assistantMessage);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.filter((item) => item.status === "succeeded").length, 6);
  assert.equal(
    calls.filter(
      (item) => item.status === "failed" && item.error_code === "call_limit",
    ).length,
    1,
  );
  assert.ok(
    calls.every(
      (item) => item.assistant_message_id === result.assistantMessage?.id,
    ),
  );
});

test("the agent reserves a final answer step after repeated searches", async () => {
  useReply("Here are the available catalog choices");
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);

    if (args[0].toolChoice?.type === "none") return result;

    return {
      ...result,
      content: [
        {
          type: "tool-call",
          toolCallId: `step-${model.doGenerateCalls.length}`,
          toolName: "searchPublicCatalog",
          input: JSON.stringify({ catalogType: "package" }),
        },
      ],
      finishReason: { unified: "tool-calls", raw: undefined },
    };
  };
  const result = await send(await conversation(), "Keep looking for packages");
  assert.equal(result.assistantError, null);
  assert.equal(
    result.assistantMessage?.body,
    "Here are the available catalog choices",
  );
  assert.equal(model.doGenerateCalls.length, 4);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.length, 3);
});

test("invalid tool arguments cannot execute a search", async () => {
  useCatalogCalls([
    { catalogType: "service", pax: 80, conversationId: randomUUID() },
  ]);
  const result = await send(await conversation(), "Find a service");
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.length, 0);
});

test("private booking reads reject model-supplied scope before execution", async () => {
  const { id } = await bookingFactsConversation();
  const foreignBooking = await booking(other.id, `FOREIGN-${randomUUID()}`);
  useToolCalls([
    { toolName: "getMySentQuotation", input: { bookingId: foreignBooking } },
    { toolName: "getMyRequestHistory", input: { customerId: other.id } },
  ]);
  const result = await send(id, "Read the quotation and latest status change");
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.length, 0);
});

test("oversized model tool batches are rejected before recording or searching", async () => {
  useCatalogCalls(
    Array.from({ length: 13 }, () => ({ catalogType: "package" })),
  );
  const result = await send(await conversation(), "Find many packages");
  assert.equal(result.assistantMessage, null);
  assert.ok(result.assistantError);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.length, 0);
});

test("later turns receive only their conversation's delivered search pagination, without stale prices", async () => {
  for (let index = 0; index < 6; index++)
    await db
      .insertInto("packages")
      .values({
        name: `Continuation ${index}`,
        slug: `continuation-${randomUUID()}`,
        max_guests: 100,
        price: 3333,
      })
      .execute();

  const id = await conversation();
  const input = {
    catalogType: "package",
    minPricePesos: 3333,
    maxPricePesos: 3333,
    pax: 80,
  };
  useCatalogCalls([input]);
  const first = await send(id, "Find packages for 80 guests");
  assert.ok(first.assistantMessage);
  const saved = await db
    .selectFrom("ai_tool_calls")
    .select("output")
    .where("customer_message_id", "=", first.message.id)
    .executeTakeFirstOrThrow();
  assert.ok(
    saved.output &&
      typeof saved.output === "object" &&
      "nextCursor" in saved.output,
  );
  const nextCursor = saved.output.nextCursor;
  assert.equal(typeof nextCursor, "string");
  useCatalogCalls([{ ...input, cursor: nextCursor }]);
  await send(id, "Show more");
  const snapshot = turnContext(0).context;
  assert.ok("previousCatalogSearch" in snapshot);
  const pagination = snapshot.previousCatalogSearch;
  assert.ok(pagination && typeof pagination === "object");
  assert.ok("input" in pagination && "nextCursor" in pagination);
  assert.deepEqual(pagination.input, input);
  assert.equal(typeof pagination.nextCursor, "string");
  assert.doesNotMatch(JSON.stringify(pagination), /amountPesos|Continuation/);
  useReply("A different conversation");
  await send(await conversation(), "Show more");
  assert.equal("previousCatalogSearch" in turnContext(0).context, false);
});

test("later detail turns retain only delivered same-conversation selectors and continuation", async () => {
  const packageId = await detailPackage();
  const originalText = "original-canvas-marker ".repeat(300);
  await db
    .updateTable("packages")
    .set({
      canvas: sql`${JSON.stringify([
        {
          id: randomUUID(),
          title: "Details",
          widgets: [
            {
              id: randomUUID(),
              type: "markdown",
              x: 0,
              y: 0,
              w: 12,
              h: 4,
              markdown: originalText,
              mediaId: null,
              alt: "",
              caption: "",
              autoplay: false,
            },
          ],
        },
      ])}::jsonb`,
    })
    .where("id", "=", packageId)
    .execute();
  const conversationId = await conversation();
  const input = { catalogType: "package", id: packageId };
  useToolCalls([{ toolName: "getPublicCatalogItem", input }]);
  const first = await send(conversationId, "Read the details");
  assert.ok(first.assistantMessage);
  const saved = await db
    .selectFrom("ai_tool_calls")
    .select("output")
    .where("tool_name", "=", "getPublicCatalogItem")
    .where("customer_message_id", "=", first.message.id)
    .executeTakeFirstOrThrow();
  assert.ok(
    saved.output &&
      typeof saved.output === "object" &&
      "nextCursor" in saved.output,
  );
  assert.equal(typeof saved.output.nextCursor, "string");
  useReply("Follow-up");
  await send(conversationId, "Continue reading");
  const context = turnContext(0).context;
  assert.ok("previousCatalogItem" in context);
  assert.deepEqual(context.previousCatalogItem, {
    input,
    nextCursor: saved.output.nextCursor,
  });
  useReply("Separate conversation");
  await send(await conversation(), "Continue reading");
  assert.equal("previousCatalogItem" in turnContext(0).context, false);

  const undelivered = await conversation();
  useToolCalls([{ toolName: "getPublicCatalogItem", input }], async () => {
    throw new Error("fixture provider failure");
  });
  const failed = await send(
    undelivered,
    "Read details before provider failure",
  );
  assert.equal(failed.assistantMessage, null);
  useReply("Retry later");
  await send(undelivered, "Continue reading");
  assert.equal("previousCatalogItem" in turnContext(0).context, false);
});

test("tracking failure preserves the customer message and never publishes an untracked result", async () => {
  await pool.query(`CREATE FUNCTION reject_fixture_tool_tracking() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-tracking-payload'; END $$;
    CREATE TRIGGER reject_fixture_tool_tracking BEFORE INSERT ON ai_tool_calls
    FOR EACH ROW EXECUTE FUNCTION reject_fixture_tool_tracking()`);

  try {
    useCatalogCalls([{ catalogType: "package" }]);
    const result = await send(await conversation(), "Show catalog packages");
    assert.equal(result.assistantMessage, null);
    assert.ok(result.assistantError);
    assert.doesNotMatch(JSON.stringify(result), /private-tracking-payload/);
    assert.doesNotMatch(
      JSON.stringify(model.doGenerateCalls.at(-1)?.prompt),
      /private-tracking-payload/,
    );
    assert.ok(
      await db
        .selectFrom("messages")
        .select("id")
        .where("id", "=", result.message.id)
        .executeTakeFirst(),
    );
  } finally {
    await pool.query(`DROP TRIGGER reject_fixture_tool_tracking ON ai_tool_calls;
      DROP FUNCTION reject_fixture_tool_tracking()`);
  }
});

test("takeover during search prevents its result from entering the answer", async () => {
  const originalFetch = globalThis.fetch;
  const originalEmbeddingModel = process.env.EMBEDDING_MODEL;
  const id = await conversation();
  process.env.EMBEDDING_MODEL = "google/gemini-embedding-2";
  globalThis.fetch = async () => {
    assert.equal(
      (
        await call(`/admin/conversations/${id}/messages`, team.cookie, {
          body: "I will handle this inquiry",
        })
      ).status,
      201,
    );

    return new Response(
      JSON.stringify({
        embeddings: [[1, ...Array(767).fill(0)]],
        warnings: [],
      }),
      { headers: { "content-type": "application/json" } },
    );
  };

  try {
    useCatalogCalls([{ catalogType: "package", query: "garden" }]);
    const result = await send(id, "Find a garden package");
    assert.equal(result.assistantMessage, null);
    assert.equal(result.assistantError, null);
    const record = await db
      .selectFrom("ai_tool_calls")
      .selectAll()
      .where("customer_message_id", "=", result.message.id)
      .executeTakeFirstOrThrow();
    assert.equal(record.status, "failed");
    assert.equal(record.error_code, "turn_inactive");
    assert.equal(record.output, null);
    assert.equal(record.assistant_message_id, null);
  } finally {
    globalThis.fetch = originalFetch;

    if (originalEmbeddingModel === undefined)
      delete process.env.EMBEDDING_MODEL;
    else process.env.EMBEDDING_MODEL = originalEmbeddingModel;
  }
});

test("customer proposal tool returns scoped JSON and records only bounded audit metadata", async () => {
  const bookingId = await booking(customer.id, `PROPOSAL-${randomUUID()}`);
  const id = (
    await db
      .insertInto("conversations")
      .values({ customer_id: customer.id, booking_request_id: bookingId })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  const marker = `private-proposal-${randomUUID()}`;
  const originalMarkdown = `${marker}\n${"Original **widget** text. ".repeat(700)}`;

  const sections = [
    {
      id: randomUUID(),
      title: "Saved proposal canvas",
      widgets: Array.from({ length: 5 }, (_, index) => ({
        id: randomUUID(),
        type: "markdown",
        x: 0,
        y: index * 4,
        w: 12,
        h: 4,
        markdown: originalMarkdown,
        mediaId: null,
        alt: "",
        caption: "",
        autoplay: false,
      })),
    },
  ];

  await db
    .insertInto("packages")
    .values({
      name: marker,
      slug: `private-${randomUUID()}`,
      description: marker,
      price: 1200,
      max_guests: 60,
      package_type: "custom",
      custom_for_booking_request_id: bookingId,
      published_at: null,
      canvas: sql`${JSON.stringify(sections)}::jsonb`,
    })
    .execute();
  useToolCalls([
    { toolName: "getMyProposal", input: {} },
    { toolName: "getMyProposal", input: {} },
    { toolName: "getMyProposal", input: {} },
  ]);
  const result = await send(id, "What is my proposal?");
  assert.equal(result.assistantError, null);
  assert.ok(result.assistantMessage);

  const message = model.doGenerateCalls[1].prompt.find(
    (item) =>
      item.role === "tool" &&
      item.content.some(
        (part) =>
          part.type === "tool-result" && part.toolName === "getMyProposal",
      ),
  );

  assert.ok(message?.role === "tool");

  const part = message.content.find(
    (item) => item.type === "tool-result" && item.toolName === "getMyProposal",
  );

  assert.ok(part && part.type === "tool-result");
  assert.equal(part.output.type, "json");

  if (part.output.type !== "json") throw new Error("Expected JSON proposal");

  assert.match(JSON.stringify(part.output.value), new RegExp(marker));
  assert.ok(JSON.stringify(part.output.value).length > 65536);
  assert.deepEqual(
    JSON.parse(JSON.stringify(part.output.value)).proposal.sections,
    sections.map((section) => ({
      ...section,
      widgets: section.widgets.map(({ mediaId, ...widget }) => ({
        ...widget,
        media: null,
      })),
    })),
  );
  const records = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("tool_name", "=", "getMyProposal")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(records.length, 3);
  assert.equal(
    records.filter((record) => record.status === "succeeded").length,
    2,
  );
  assert.equal(
    records.filter((record) => record.error_code === "proposal_too_large")
      .length,
    1,
  );

  for (const record of records) {
    assert.equal(record.tool_name, "getMyProposal");
    assert.equal(record.assistant_message_id, result.assistantMessage.id);
    assert.doesNotMatch(JSON.stringify(record.output), new RegExp(marker));

    if (record.status === "succeeded")
      assert.match(JSON.stringify(record.output), /[a-f0-9]{64}/i);
  }
});

test("a near-budget proposal remains available when conversation memory is present", async () => {
  const bookingId = await booking(customer.id, `BUDGET-${randomUUID()}`);
  const id = (
    await db
      .insertInto("conversations")
      .values({ customer_id: customer.id, booking_request_id: bookingId })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;

  const sections = [
    {
      id: randomUUID(),
      title: "Large proposal",
      widgets: Array.from({ length: 10 }, (_, index) => ({
        id: randomUUID(),
        type: "markdown",
        x: 0,
        y: index * 4,
        w: 12,
        h: 4,
        markdown: `${index}:` + "x".repeat(19_648),
        mediaId: null,
        alt: "",
        caption: "",
        autoplay: false,
      })),
    },
  ];

  await db
    .insertInto("packages")
    .values({
      name: "Budget proposal",
      slug: `budget-${randomUUID()}`,
      description: "",
      price: 1200,
      max_guests: 60,
      package_type: "custom",
      custom_for_booking_request_id: bookingId,
      published_at: null,
      canvas: sql`${JSON.stringify(sections)}::jsonb`,
    })
    .execute();
  const proposal = await getMyProposalService({
    db,
    customerId: customer.id,
    conversationId: id,
  });
  assert.equal(proposal.status, "found");
  const proposalCharacters = JSON.stringify(proposal).length;

  // Measure the same booking context without a note, then leave 1,000 characters
  // of the original budget. The 2,000-character note would exceed that margin.
  useReply("Probe");
  const probe = await send(id, "x");
  assert.ok(probe.assistantMessage);

  const contextPart = model.doGenerateCalls[0].prompt
    .flatMap((message) => (message.role === "user" ? message.content : []))
    .find(
      (part) =>
        part.type === "text" &&
        part.text.includes("Current server-built context snapshot"),
    );

  assert.ok(contextPart && contextPart.type === "text");
  await db
    .deleteFrom("messages")
    .where("id", "=", probe.assistantMessage.id)
    .execute();
  await db.deleteFrom("messages").where("id", "=", probe.message.id).execute();
  const bodyLength =
    200_000 - proposalCharacters - contextPart.text.length - 1_000;
  assert.ok(
    bodyLength > 0 && bodyLength <= 4_000,
    `Unexpected fixture headroom: ${bodyLength}`,
  );
  const note = `Memory marker ${'\\"'.repeat(993)}`;
  await pool.query(
    "UPDATE conversations SET conversation_memory = $1 WHERE id = $2",
    [note, id],
  );
  useToolCalls([{ toolName: "getMyProposal", input: {} }]);
  const result = await send(id, "q".repeat(bodyLength));
  assert.ok(result.assistantMessage);
  const context = turnContext(0).context;
  assert.ok("conversationMemory" in context);
  assert.equal(context.conversationMemory, note);

  const toolMessage = model.doGenerateCalls[1].prompt.find(
    (message) =>
      message.role === "tool" &&
      message.content.some(
        (part) =>
          part.type === "tool-result" && part.toolName === "getMyProposal",
      ),
  );

  assert.ok(toolMessage?.role === "tool");

  const part = toolMessage.content.find(
    (item) => item.type === "tool-result" && item.toolName === "getMyProposal",
  );

  assert.ok(part && part.type === "tool-result" && part.output.type === "json");
  assert.deepEqual(part.output.value, JSON.parse(JSON.stringify(proposal)));
  const audit = await db
    .selectFrom("ai_tool_calls")
    .select(["status", "error_code"])
    .where("customer_message_id", "=", result.message.id)
    .where("tool_name", "=", "getMyProposal")
    .executeTakeFirstOrThrow();
  assert.equal(audit.status, "succeeded");
  assert.equal(audit.error_code, null);
});

test("proposal tool input cannot redirect to another conversation", async () => {
  const ownId = await conversation();
  const otherBooking = await booking(other.id, `SECRET-${randomUUID()}`);
  const otherId = (
    await db
      .insertInto("conversations")
      .values({ customer_id: other.id, booking_request_id: otherBooking })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  useToolCalls([
    {
      toolName: "getMyProposal",
      input: { conversationId: otherId, customerId: other.id },
    },
  ]);
  await send(ownId, "Read my proposal");
  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls.slice(1)),
    /Private package marker/,
  );
});

test("takeover suppresses a reply after a proposal tool result", async () => {
  const bookingId = await booking(customer.id, `TAKEOVER-${randomUUID()}`);
  const id = (
    await db
      .insertInto("conversations")
      .values({ customer_id: customer.id, booking_request_id: bookingId })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  useToolCalls([{ toolName: "getMyProposal", input: {} }], async () => {
    assert.equal((await setAi(id, false, 0)).status, 200);
  });
  const result = await send(id, "Read my proposal");
  assert.equal(result.assistantMessage, null);
  const records = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("tool_name", "=", "getMyProposal")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(records.length, 1);
  assert.equal(records[0].assistant_message_id, null);
});

test("proposal exceeding the turn input budget fails explicitly without returning partial widget text", async () => {
  const bookingId = await booking(customer.id, `LARGE-${randomUUID()}`);
  const id = (
    await db
      .insertInto("conversations")
      .values({ customer_id: customer.id, booking_request_id: bookingId })
      .returning("id")
      .executeTakeFirstOrThrow()
  ).id;
  const marker = `large-private-${randomUUID()}`;

  const sections = [
    {
      id: randomUUID(),
      title: "Large proposal",
      widgets: Array.from({ length: 11 }, (_, index) => ({
        id: randomUUID(),
        type: "markdown",
        x: 0,
        y: index * 4,
        w: 12,
        h: 4,
        markdown: marker + "x".repeat(19000),
        mediaId: null,
        alt: "",
        caption: "",
        autoplay: false,
      })),
    },
  ];

  await db
    .insertInto("packages")
    .values({
      name: "Large private proposal",
      slug: `large-${randomUUID()}`,
      description: "",
      price: 1200,
      max_guests: 60,
      package_type: "custom",
      custom_for_booking_request_id: bookingId,
      published_at: null,
      canvas: sql`${JSON.stringify(sections)}::jsonb`,
    })
    .execute();
  useToolCalls([{ toolName: "getMyProposal", input: {} }]);
  const result = await send(id, "Read my proposal");
  assert.ok(result.assistantMessage);
  assert.equal(result.assistantError, null);
  const record = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("tool_name", "=", "getMyProposal")
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(record.status, "failed");
  assert.equal(record.error_code, "proposal_too_large");
  assert.equal(record.output, null);
  const prompt = JSON.stringify(model.doGenerateCalls[1].prompt);
  assert.match(
    prompt,
    /The full proposal exceeds this turn's input budget and was not returned/,
  );
  assert.doesNotMatch(prompt, new RegExp(marker));
});

test("an implicit proposal follow-up can read current state after an earlier denial", async () => {
  const id = await conversation();
  useReply("There is no proposal for you yet.");
  const first = await send(id, "Is there a proposal?");
  assert.ok(first.assistantMessage);
  const bookingId = await booking(customer.id, `FOLLOWUP-${randomUUID()}`);
  await db
    .updateTable("conversations")
    .set({ booking_request_id: bookingId })
    .where("id", "=", id)
    .execute();
  useReply("Your current proposal is available.");
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);

    if (model.doGenerateCalls.length !== 1) return result;

    return {
      ...result,
      content: [
        {
          type: "tool-call",
          toolCallId: "current-proposal",
          toolName: "getMyProposal",
          input: "{}",
        },
      ],
      finishReason: { unified: "tool-calls", raw: undefined },
    };
  };
  const second = await send(id, "What about now?");
  assert.ok(second.assistantMessage);
  const prompt = JSON.stringify(model.doGenerateCalls[1].prompt);
  assert.match(
    prompt,
    /Previous assistant reply \(unverified historical claims\)/,
  );
  assert.match(prompt, /Private package marker/);
  assert.match(prompt, /FOLLOWUP-/);
  const reader = await db
    .selectFrom("ai_tool_calls")
    .select(["status", "assistant_message_id"])
    .where("customer_message_id", "=", second.message.id)
    .where("tool_name", "=", "getMyProposal")
    .executeTakeFirstOrThrow();
  assert.equal(reader.status, "succeeded");
  assert.equal(reader.assistant_message_id, second.assistantMessage.id);
});

test("the assistant can answer directly without calling a tool", async () => {
  useReply("Hello from AMAC AI");
  const result = await send(await conversation(), "Hello");
  assert.equal(result.assistantError, null);
  assert.equal(result.assistantMessage?.body, "Hello from AMAC AI");
  assert.equal(model.doGenerateCalls.length, 1);
  assert.deepEqual(model.doGenerateCalls[0].toolChoice, { type: "auto" });
  assert.deepEqual(
    model.doGenerateCalls[0].tools?.map((entry) => entry.name).sort(),
    [
      "getMyProposal",
      "getMyRequestHistory",
      "getMySentQuotation",
      "getPublicCatalogItem",
      "requestHumanHandoff",
      "searchPublicCatalog",
      "updateConversationMemory",
    ],
  );
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.equal(calls.length, 0);
});

test("conversation memory is optional, scoped, private, and can be corrected on a later turn", async () => {
  const id = await conversation();
  const otherId = await conversation();
  const original = `Private memory ${randomUUID()}: prefers a garden`;
  const corrected = `Private memory ${randomUUID()}: prefers indoors`;

  const memory = async (conversationId: string) =>
    (
      await pool.query<{ conversation_memory: string | null }>(
        "SELECT conversation_memory FROM conversations WHERE id = $1",
        [conversationId],
      )
    ).rows[0].conversation_memory;

  useReply("Hello");
  await send(id, "Hello");
  assert.equal(await memory(id), null);

  useToolCalls([
    {
      toolName: "updateConversationMemory",
      input: { markdown: `  ${original}  ` },
    },
  ]);
  const first = await send(id, "I prefer a garden");
  assert.equal(await memory(id), original);
  assert.equal(await memory(otherId), null);
  const audit = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", first.message.id)
    .where("tool_name", "=", "updateConversationMemory")
    .executeTakeFirstOrThrow();
  assert.equal(audit.status, "succeeded");
  assert.equal(audit.assistant_message_id, first.assistantMessage?.id);
  assert.doesNotMatch(JSON.stringify(audit.input), new RegExp(original));
  assert.doesNotMatch(JSON.stringify(audit.output), new RegExp(original));
  assert.ok(JSON.stringify(audit.output).length < 2000);

  useToolCalls([
    { toolName: "updateConversationMemory", input: { markdown: corrected } },
  ]);
  await send(id, "Actually, I prefer indoors");
  const correctionContext = turnContext(0).context;
  assert.ok("conversationMemory" in correctionContext);
  assert.equal(correctionContext.conversationMemory, original);
  assert.equal(await memory(id), corrected);

  useReply("Understood");
  const result = await send(id, "Thanks");
  const nextContext = turnContext(0).context;
  assert.ok("conversationMemory" in nextContext);
  assert.equal(nextContext.conversationMemory, corrected);

  for (const payload of [
    result,
    await (await call(`/messages/conversations/${id}`, customer.cookie)).json(),
    await (await call("/messages/conversations", customer.cookie)).json(),
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
    await (await call("/admin/conversations", team.cookie)).json(),
  ]) {
    assert.doesNotMatch(JSON.stringify(payload), new RegExp(corrected));
    assert.doesNotMatch(
      JSON.stringify(payload),
      /conversationMemory|conversation_memory/,
    );
  }
});

test("memory incorporates a saved admin message after AI is re-enabled", async () => {
  const id = await conversation();
  const initial = "Customer prefers a garden";
  const teamMessage = "We can set up a covered garden area";
  const updated = "Customer prefers a garden; team can provide a covered area";
  useToolCalls([
    { toolName: "updateConversationMemory", input: { markdown: initial } },
  ]);
  await send(id, "I prefer a garden");
  const adminReply = await call(
    `/admin/conversations/${id}/messages`,
    team.cookie,
    {
      body: teamMessage,
    },
  );
  assert.equal(adminReply.status, 201);
  const takeover = await adminReply.json();
  assert.equal(takeover.aiEnabled, false);
  assert.equal((await setAi(id, true, takeover.aiVersion)).status, 200);

  useToolCalls([
    { toolName: "updateConversationMemory", input: { markdown: updated } },
  ]);
  const result = await send(id, "Please remember the setup we discussed");
  assert.ok(result.assistantMessage);
  const context = turnContext(0).context;
  assert.ok("conversationMemory" in context);
  assert.equal(context.conversationMemory, initial);
  assert.match(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /AMAC team: We can set up a covered garden area/,
  );
  const row = await pool.query<{ conversation_memory: string | null }>(
    "SELECT conversation_memory FROM conversations WHERE id = $1",
    [id],
  );
  assert.equal(row.rows[0].conversation_memory, updated);
});

test("memory update rejects identifiers, empty, oversized and NUL text", async () => {
  const id = await conversation();
  const otherId = await conversation();

  for (const input of [
    { markdown: "redirected", conversationId: otherId },
    { markdown: " " },
    { markdown: "x".repeat(2001) },
    { markdown: "invalid\0memory" },
  ]) {
    useToolCalls([{ toolName: "updateConversationMemory", input }]);
    await send(id, "Remember this");
  }

  const rows = await pool.query<{ conversation_memory: string | null }>(
    "SELECT conversation_memory FROM conversations WHERE id = ANY($1::uuid[])",
    [[id, otherId]],
  );
  assert.deepEqual(
    rows.rows.map((row) => row.conversation_memory),
    [null, null],
  );
});

test("an older customer trigger cannot see or overwrite a newer conversation memory", async () => {
  const id = await conversation();
  const old = await db
    .insertInto("messages")
    .values({
      conversation_id: id,
      sender_id: customer.id,
      sender_role: "customer",
      body: "Old question",
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
      body: "New correction",
      created_at: new Date("2026-01-01T00:00:01Z"),
    })
    .execute();
  const newer = `newer-memory-${randomUUID()}`;
  await pool.query(
    "UPDATE conversations SET conversation_memory = $1 WHERE id = $2",
    [newer, id],
  );
  useToolCalls([
    {
      toolName: "updateConversationMemory",
      input: { markdown: "stale overwrite" },
    },
  ]);
  await runAssistantTurnService({
    db,
    conversationId: id,
    customerId: customer.id,
    customerMessageId: old.id,
    aiVersion: 0,
  });
  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    new RegExp(newer),
  );
  const row = await pool.query<{ conversation_memory: string }>(
    "SELECT conversation_memory FROM conversations WHERE id = $1",
    [id],
  );
  assert.equal(row.rows[0].conversation_memory, newer);
});

test("a newer customer message fences an in-flight memory update without suppressing the reply", async () => {
  const id = await conversation();
  const initial = "Existing memory";
  await pool.query(
    "UPDATE conversations SET conversation_memory = $1 WHERE id = $2",
    [initial, id],
  );
  useToolCalls([
    {
      toolName: "updateConversationMemory",
      input: { markdown: "Stale update" },
    },
  ]);
  let started!: () => void;
  let release!: () => void;

  const generating = new Promise<void>((resolve) => {
    started = resolve;
  });

  const resume = new Promise<void>((resolve) => {
    release = resolve;
  });

  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    started();
    await resume;

    return generate(...args);
  };
  const pending = send(id, "Earlier customer message");
  await Promise.race([
    generating,
    pending.then(() => {
      throw new Error("Generation did not start");
    }),
  ]);

  try {
    await db
      .insertInto("messages")
      .values({
        conversation_id: id,
        sender_id: customer.id,
        sender_role: "customer",
        body: "Newer customer message",
        created_at: new Date(Date.now() + 1000),
      })
      .execute();
  } finally {
    release();
  }

  const result = await pending;
  assert.ok(result.assistantMessage);
  assert.equal(result.assistantMessage?.body, "Catalog results are ready");
  assert.equal(result.assistantError, null);
  assert.ok(
    model.doGenerateCalls[0].tools?.some(
      (tool) => tool.name === "updateConversationMemory",
    ),
  );
  const audit = await db
    .selectFrom("ai_tool_calls")
    .select(["status", "output"])
    .where("customer_message_id", "=", result.message.id)
    .where("tool_name", "=", "updateConversationMemory")
    .executeTakeFirstOrThrow();
  assert.equal(audit.status, "succeeded");
  assert.deepEqual(audit.output, { status: "skipped" });
  const savedReply = await db
    .selectFrom("messages")
    .select("body")
    .where("id", "=", result.assistantMessage.id)
    .executeTakeFirstOrThrow();
  assert.equal(savedReply.body, "Catalog results are ready");
  const row = await pool.query<{ conversation_memory: string | null }>(
    "SELECT conversation_memory FROM conversations WHERE id = $1",
    [id],
  );
  assert.equal(row.rows[0].conversation_memory, initial);
});

test("admin takeover prevents an in-flight memory update", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateConversationMemory",
      input: { markdown: "stale memory" },
    },
  ]);
  let started!: () => void;
  let release!: () => void;

  const generating = new Promise<void>((resolve) => {
    started = resolve;
  });

  const resume = new Promise<void>((resolve) => {
    release = resolve;
  });

  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    started();
    await resume;

    return generate(...args);
  };
  const pending = send(id, "Before takeover");
  await Promise.race([
    generating,
    pending.then(() => {
      throw new Error("Generation did not start");
    }),
  ]);

  try {
    assert.equal((await setAi(id, false, 0)).status, 200);
    assert.equal((await setAi(id, true, 1)).status, 200);
  } finally {
    release();
  }

  const result = await pending;
  assert.equal(result.assistantMessage, null);
  const row = await pool.query<{ conversation_memory: string | null }>(
    "SELECT conversation_memory FROM conversations WHERE id = $1",
    [id],
  );
  assert.equal(row.rows[0].conversation_memory, null);
});

const handoffInput = {
  reason: "customer_requested",
  summary: "  Customer wants a human to discuss their event.  ",
};

async function handoffFixture() {
  const id = await conversation();
  const message = await db
    .insertInto("messages")
    .values({
      conversation_id: id,
      sender_id: customer.id,
      sender_role: "customer",
      body: "Please get a person",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return {
    conversationId: id,
    customerId: customer.id,
    customerMessageId: message.id,
    aiVersion: 0,
  };
}

async function invokeHandoff(
  scope: Awaited<ReturnType<typeof handoffFixture>>,
  input = handoffInput,
) {
  const turnId = randomUUID();
  const call = await startToolCallData(db, {
    turnId,
    toolCallId: randomUUID(),
    toolName: "requestHumanHandoff",
    customerMessageId: scope.customerMessageId,
    input,
  });

  return requestHumanHandoffService({
    db,
    scope,
    input,
    callId: call.id,
    turnId,
  });
}

test("handoff commits its acknowledgement and audit, stops the loop and keeps admin metadata private", async () => {
  useToolCalls(
    [
      { toolName: "requestHumanHandoff", input: handoffInput },
      { toolName: "getMyProposal", input: {} },
    ],
    async () => {
      throw new Error("No generation is allowed after the committed handoff");
    },
  );
  const id = await conversation();
  const result = await send(id, "Please let me talk to someone");
  assert.equal(result.assistantError, null);
  assert.equal(result.assistantMessage?.body, humanHandoffAcknowledgement);
  assert.equal(model.doGenerateCalls.length, 1);
  const state = await db
    .selectFrom("conversations")
    .select(["ai_handoff", "ai_enabled", "ai_version"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(state, {
    ai_handoff: {
      reason: "customer_requested",
      summary: handoffInput.summary.trim(),
      pending: true,
    },
    ai_enabled: false,
    ai_version: 1,
  });
  const audit = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(audit.status, "succeeded");
  assert.equal(audit.assistant_message_id, result.assistantMessage?.id);
  const adminThread = await (
    await call(`/admin/conversations/${id}`, team.cookie)
  ).json();
  assert.deepEqual(adminThread.conversation.aiHandoff, state.ai_handoff);
  const adminList = await (
    await call("/admin/conversations", team.cookie)
  ).json();
  assert.deepEqual(
    adminList.conversations.find((item: { id: string }) => item.id === id)
      .aiHandoff,
    state.ai_handoff,
  );
  const customerThread = await (
    await call(`/messages/conversations/${id}`, customer.cookie)
  ).json();
  assert.equal("aiHandoff" in customerThread.conversation, false);
  const customerList = await (
    await call("/messages/conversations", customer.cookie)
  ).json();
  assert.ok(
    customerList.conversations.every((item: object) => !("aiHandoff" in item)),
  );
});

test("concurrent and repeated handoff calls reuse one acknowledgement and preserve the first reason", async () => {
  const scope = await handoffFixture();
  const messages = await Promise.all([
    invokeHandoff(scope),
    invokeHandoff(scope),
  ]);
  const retry = await invokeHandoff(scope, {
    reason: "cannot_answer",
    summary: "A later summary must not overwrite the first",
  });
  assert.equal(messages[0].id, messages[1].id);
  assert.equal(retry.id, messages[0].id);
  const replies = await db
    .selectFrom("messages")
    .select("id")
    .where("conversation_id", "=", scope.conversationId)
    .where("sender_role", "=", "assistant")
    .execute();
  assert.equal(replies.length, 1);
  const state = await db
    .selectFrom("conversations")
    .select(["ai_handoff", "ai_version"])
    .where("id", "=", scope.conversationId)
    .executeTakeFirstOrThrow();
  assert.deepEqual(state.ai_handoff, {
    reason: "customer_requested",
    summary: handoffInput.summary.trim(),
    pending: true,
  });
  assert.equal(state.ai_version, 1);
});

test("a handoff tracking-completion failure rolls back its state and acknowledgement", async () => {
  const scope = await handoffFixture();
  await pool.query(
    "CREATE FUNCTION reject_handoff_completion_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tool_name = 'requestHumanHandoff' AND NEW.status = 'succeeded' THEN RAISE EXCEPTION 'fixture audit completion failure'; END IF; RETURN NEW; END $$",
  );
  await pool.query(
    "CREATE TRIGGER reject_handoff_completion_test BEFORE UPDATE ON ai_tool_calls FOR EACH ROW EXECUTE FUNCTION reject_handoff_completion_test()",
  );

  try {
    await assert.rejects(invokeHandoff(scope));
  } finally {
    await pool.query(
      "DROP TRIGGER reject_handoff_completion_test ON ai_tool_calls",
    );
    await pool.query("DROP FUNCTION reject_handoff_completion_test()");
  }

  const state = await db
    .selectFrom("conversations")
    .select(["ai_handoff", "ai_enabled", "ai_version"])
    .where("id", "=", scope.conversationId)
    .executeTakeFirstOrThrow();
  assert.deepEqual(state, {
    ai_handoff: null,
    ai_enabled: true,
    ai_version: 0,
  });
  assert.equal(
    (
      await db
        .selectFrom("messages")
        .select("id")
        .where("conversation_id", "=", scope.conversationId)
        .where("sender_role", "=", "assistant")
        .execute()
    ).length,
    0,
  );
});

test("handoff rejects stale takeover, off/on cycles and mismatched triggering message scope", async () => {
  for (const resume of [false, true]) {
    const scope = await handoffFixture();
    assert.equal((await setAi(scope.conversationId, false, 0)).status, 200);

    if (resume)
      assert.equal((await setAi(scope.conversationId, true, 1)).status, 200);

    await assert.rejects(invokeHandoff(scope));
    const state = await db
      .selectFrom("conversations")
      .select("ai_handoff")
      .where("id", "=", scope.conversationId)
      .executeTakeFirstOrThrow();
    assert.equal(state.ai_handoff, null);
  }

  const own = await handoffFixture();
  const another = await handoffFixture();
  await assert.rejects(
    invokeHandoff({ ...own, customerMessageId: another.customerMessageId }),
  );
  await assert.rejects(invokeHandoff({ ...own, customerId: other.id }));
});

test("failed admin replies retain pending, first successful reply clears it, and AI resume preserves pending", async () => {
  const scope = await handoffFixture();
  await invokeHandoff(scope);
  assert.equal(
    (
      await call(
        `/admin/conversations/${scope.conversationId}/messages`,
        team.cookie,
        { body: "" },
      )
    ).status,
    400,
  );
  let state = await db
    .selectFrom("conversations")
    .selectAll()
    .where("id", "=", scope.conversationId)
    .executeTakeFirstOrThrow();
  assert.equal(state.ai_version, 1);
  assert.deepEqual(state.ai_handoff, {
    reason: "customer_requested",
    summary: handoffInput.summary.trim(),
    pending: true,
  });
  const replied = await (
    await call(
      `/admin/conversations/${scope.conversationId}/messages`,
      team.cookie,
      { body: "I can help" },
    )
  ).json();
  assert.equal(replied.aiVersion, 2);
  assert.equal(replied.aiHandoff.pending, false);
  assert.equal(replied.aiEnabled, false);
  const secondReply = await (
    await call(
      `/admin/conversations/${scope.conversationId}/messages`,
      team.cookie,
      { body: "One more detail" },
    )
  ).json();
  assert.equal(secondReply.aiVersion, 2);
  const resumedScope = await handoffFixture();
  await invokeHandoff(resumedScope);
  const resumed = await (
    await setAi(resumedScope.conversationId, true, 1)
  ).json();
  assert.deepEqual(resumed, {
    aiEnabled: true,
    aiVersion: 2,
    aiHandoff: {
      reason: "customer_requested",
      summary: handoffInput.summary.trim(),
      pending: true,
    },
  });
  useReply("Future messages use AI again");
  const future = await send(resumedScope.conversationId, "Hello again");
  assert.equal(future.assistantMessage?.body, "Future messages use AI again");
});

test("handoff model input cannot supply identifiers or omit a meaningful bounded summary", async () => {
  for (const input of [
    { ...handoffInput, conversationId: randomUUID() },
    { ...handoffInput, customerId: other.id },
    { ...handoffInput, summary: " " },
    { ...handoffInput, summary: "x".repeat(1001) },
    { ...handoffInput, reason: "arbitrary_reason" },
  ]) {
    useToolCalls([{ toolName: "requestHumanHandoff", input }]);
    const id = await conversation();
    await send(id, "I need help");
    const state = await db
      .selectFrom("conversations")
      .select("ai_handoff")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    assert.equal(state.ai_handoff, null);
  }
});
