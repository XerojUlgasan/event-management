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
import type { CatalogRecommendation } from "@event-management/contracts/messages";
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
import { getMyPackageService } from "../../src/services/ai/get-my-package.js";

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

function isAssistantPrompt(
  prompt: MockLanguageModelV4["doGenerateCalls"][number]["prompt"],
) {
  return prompt.some(
    (message) =>
      message.role === "system" &&
      message.content.includes("## Suggested customer replies"),
  );
}

function useReply(text: string, suggestions: string[] = []) {
  model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => ({
      content: [
        {
          type: "text",
          text: prompt.some(
            (message) =>
              message.role === "system" &&
              message.content.startsWith(
                "Translate AMAC's booking message copy",
              ),
          )
            ? JSON.stringify({ style: "en", copy: null })
            : isAssistantPrompt(prompt)
              ? JSON.stringify({
                  message: text,
                  suggested_replies: suggestions,
                })
              : text,
        },
      ],
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

function useConsent(style: "en" | "taglish" | "fil" = "en") {
  useReply(
    JSON.stringify({
      intent: "submit",
      receiptCopy: { style },
    }),
  );
}

function isConsentPrompt(
  prompt: MockLanguageModelV4["doGenerateCalls"][number]["prompt"],
) {
  return prompt.some(
    (message) =>
      message.role === "system" && message.content.startsWith("Assess consent"),
  );
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

type FixtureToolCall = {
  toolName:
    | "getBusinessInformation"
    | "searchSupportingDocuments"
    | "searchPublicCatalog"
    | "getPublicCatalogItem"
    | "attachCatalogRecommendations"
    | "getMyPackage"
    | "getLatestQuotation"
    | "getBookingDetails"
    | "requestHumanHandoff"
    | "updateConversationMemory"
    | "updateBookingDraft";
  input: Record<string, unknown>;
};

function useToolCalls(
  calls: FixtureToolCall[],
  beforeAnswer?: () => Promise<void>,
  consent?: "continue",
  reply = "Catalog results are ready",
) {
  useToolRounds([calls], beforeAnswer, consent, reply);
}

function useToolRounds(
  rounds: FixtureToolCall[][],
  beforeAnswer?: () => Promise<void>,
  consent?: "continue",
  reply = "Catalog results are ready",
  suggestions?: string[],
) {
  useReply(reply, suggestions);
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);

    if (consent && isConsentPrompt(args[0].prompt))
      return {
        ...result,
        content: [{ type: "text", text: JSON.stringify({ intent: consent }) }],
      };

    const dialogueCalls = consent
      ? model.doGenerateCalls.filter(({ prompt }) => !isConsentPrompt(prompt))
      : model.doGenerateCalls;

    const calls = rounds[dialogueCalls.length - 1];

    if (calls?.length)
      return {
        ...result,
        content: calls.map(({ toolName, input }, index) => ({
          type: "tool-call" as const,
          toolCallId:
            dialogueCalls.length === 1
              ? `catalog-call-${index}`
              : `catalog-call-${dialogueCalls.length}-${index}`,
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

async function send(
  conversationId: string,
  body: string,
  reviewMessageId?: string,
) {
  const response = await call(
    "/messages/conversation/messages",
    customer.cookie,
    {
      conversationId,
      body,
      ...(reviewMessageId ? { requestId: randomUUID(), reviewMessageId } : {}),
    },
  );
  assert.equal(response.status, 201);

  return customerMessageResultSchema.parse(await response.json());
}

test("generated customer choices persist beside their AMAC message and legacy replies remain readable", async () => {
  const id = await conversation();
  const legacy = await db
    .insertInto("messages")
    .values({
      conversation_id: id,
      body: "Mensaje anterior",
      sender_role: "assistant",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  useReply("**¿Qué tipo de evento prefieres?**", [
    "Una reunión familiar",
    " ",
    "Una reunión familiar",
  ]);
  const first = await send(id, "Quiero organizar un evento.");
  assert.equal(first.assistantError, null);
  assert.equal(
    first.assistantMessage?.body,
    "**¿Qué tipo de evento prefieres?**",
  );
  assert.deepEqual(first.assistantMessage?.suggestedReplies, [
    "Una reunión familiar",
  ]);
  const { prompt, tools } = model.doGenerateCalls[0];
  assert.match(JSON.stringify(prompt), /suggested_replies/u);
  assert.ok(tools?.some(({ name }) => name === "updateBookingDraft"));

  useReply("¿Cómo te llamas?");
  const second = await send(id, first.assistantMessage!.suggestedReplies![0]);
  assert.equal(second.message.body, "Una reunión familiar");
  assert.deepEqual(second.assistantMessage?.suggestedReplies, []);

  const thread = threadSchema.parse(
    await (await call(`/messages/conversations/${id}`, customer.cookie)).json(),
  );
  assert.equal(
    thread.messages.find(({ id }) => id === legacy.id)?.suggestedReplies,
    undefined,
  );
  assert.deepEqual(
    thread.messages.find(({ id }) => id === first.assistantMessage?.id)
      ?.suggestedReplies,
    ["Una reunión familiar"],
  );
  assert.deepEqual(thread.messages.at(-1)?.suggestedReplies, []);
});

test("provider output never displays a prefaced reply envelope as raw text", async () => {
  const id = await conversation();
  const cases = [
    {
      output: "Which event would you prefer?",
      body: "Which event would you prefer?",
      suggestions: [],
    },
    {
      output:
        'Here is my response:\n{"message":"Which event?","suggested_replies":["A wedding"]}',
      body: "Which event?",
      suggestions: ["A wedding"],
    },
    {
      output:
        'Here is my response: {"message":"Which event?","suggested_replies":',
      body: undefined,
      suggestions: undefined,
    },
  ];

  for (const [index, example] of cases.entries()) {
    useReply("");
    const generate = model.doGenerate.bind(model);
    model.doGenerate = async (...args) => ({
      ...(await generate(...args)),
      content: [{ type: "text", text: example.output }],
    });

    const result = await send(id, `Question ${index + 1}`);
    assert.equal(result.assistantMessage?.body, example.body);
    assert.deepEqual(
      result.assistantMessage?.suggestedReplies,
      example.suggestions,
    );
    assert.equal(Boolean(result.assistantError), example.body === undefined);
  }
});

test("published agent personality and switches shape the next assistant turn", async () => {
  const id = await conversation();
  const original = await db
    .selectFrom("ai_agent_settings")
    .selectAll()
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();

  try {
    await db
      .updateTable("ai_agent_settings")
      .set({
        display_name: "Room Assistant",
        personality: "professional",
        additional_instructions: "Ask about the venue after the date.",
        allow_business_information: false,
        allow_public_catalog: false,
      })
      .where("id", "=", 1)
      .execute();
    useReply("How can I help you plan your event?");
    const result = await send(id, "How can you help?");
    assert.ok(result.assistantMessage);

    const call = model.doGenerateCalls[0];
    assert.ok(call);

    const toolNames = call.tools?.map(({ name }) => name) ?? [];

    for (const name of [
      "attachCatalogRecommendations",
      "getBusinessInformation",
      "searchPublicCatalog",
      "getPublicCatalogItem",
    ])
      assert.ok(!toolNames.includes(name), name);

    assert.ok(toolNames.includes("requestHumanHandoff"));
    assert.ok(toolNames.includes("updateBookingDraft"));
    assert.ok(toolNames.includes("getLatestQuotation"));

    const system = call.prompt.find(
      (message) => message.role === "system",
    )?.content;

    assert.match(system ?? "", /Room Assistant/);
    assert.match(system ?? "", /polished, courteous/);
    assert.doesNotMatch(
      system ?? "",
      /natural contractions|Keep replies casual/,
    );
    assert.match(system ?? "", /Ask about the venue after the date/);
  } finally {
    await db
      .updateTable("ai_agent_settings")
      .set(original)
      .where("id", "=", 1)
      .execute();
  }
});

test("service clarification defers review while saving other draft changes", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Customer",
        phoneNumber: "09123456789",
        guestCount: 50,
        specialRequests: "Blue decor",
      },
    },
  ]);
  const initial = await send(id, "Please review my birthday request.");
  assert.ok(initial.assistantMessage);
  assert.match(initial.assistantMessage.body, /Should I send this request/);

  async function draft() {
    return db
      .selectFrom("conversations as c")
      .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
      .select([
        "b.id",
        "b.guest_count",
        "b.special_requests",
        "b.requested_services",
        "b.submitted_at",
      ])
      .where("c.id", "=", id)
      .executeTakeFirstOrThrow();
  }

  const original = await draft();
  const question = "Anong service po ang gusto ninyong idagdag?";
  useToolCalls([], undefined, "continue", question);
  const generic = await send(
    id,
    "pwede po mag pa addon ng services?",
    initial.assistantMessage.id,
  );
  assert.equal(generic.assistantMessage?.body, question);
  assert.deepEqual(await draft(), original);
  assert.deepEqual(
    await db
      .selectFrom("ai_tool_calls")
      .select(["tool_name", "output"])
      .where("customer_message_id", "=", generic.message.id)
      .execute(),
    [{ tool_name: "assessBookingConsent", output: { intent: "continue" } }],
  );

  useToolCalls(
    [
      {
        toolName: "updateBookingDraft",
        input: { guestCount: 60, waitForServiceChoice: true },
      },
    ],
    undefined,
    undefined,
    question,
  );
  const mixed = await send(
    id,
    "Gawing 60 guests, at pwede po magpa-addon ng services?",
  );
  assert.equal(mixed.assistantMessage?.body, question);
  const updated = await draft();
  assert.equal(updated.id, original.id);
  assert.equal(updated.guest_count, 60);
  assert.equal(updated.special_requests, "Blue decor");
  assert.deepEqual(updated.requested_services, original.requested_services);
  assert.equal(updated.submitted_at, null);

  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: { upsertServices: [{ customName: "Photo booth" }] },
    },
  ]);
  const named = await send(id, "Photo booth po.");
  assert.match(named.assistantMessage?.body ?? "", /Photo booth/);
  assert.match(named.assistantMessage?.body ?? "", /Requested services/i);
  assert.match(
    named.assistantMessage?.body ?? "",
    /Should I send this request/,
  );
  const selected = await draft();
  assert.equal(selected.id, original.id);
  assert.equal(selected.guest_count, 60);
  assert.equal(selected.special_requests, "Blue decor");
  assert.deepEqual(selected.requested_services, [
    { customName: "Photo booth" },
  ]);
  assert.equal(selected.submitted_at, null);

  useToolCalls([{ toolName: "updateBookingDraft", input: {} }]);
  const refreshed = await send(id, "Please show my request again.");
  assert.match(refreshed.assistantMessage?.body ?? "", /Photo booth/);
  assert.match(
    refreshed.assistantMessage?.body ?? "",
    /Should I send this request/,
  );
});

test("native tools collect, review and submit the same draft once", async () => {
  const id = await conversation();
  const originalPackage = await db
    .insertInto("packages")
    .values({
      name: "Garden Starter",
      slug: `draft-package-${randomUUID()}`,
      max_guests: 100,
      price: 2000,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        guestCount: 80,
        packageId: originalPackage.id,
        upsertServices: [
          { customName: "Acoustic duo", hours: 2 },
          { customName: "Face painting" },
        ],
      },
    },
  ]);
  await send(
    id,
    "Please plan a birthday for 80 guests with the Garden Starter package, an acoustic duo for two hours, and face painting.",
  );
  const intake = modelToolOutput("updateBookingDraft");
  assert.ok(intake && typeof intake === "object");
  assert.ok("nextMissingField" in intake);
  assert.equal(intake.nextMissingField, "durationMode");
  assert.equal("missingFields" in intake, false);
  const initial = await db
    .selectFrom("conversations as c")
    .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
    .select(["b.id", "b.package_id", "b.requested_services"])
    .where("c.id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(initial.package_id, originalPackage.id);
  assert.match(JSON.stringify(initial.requested_services), /Face painting/u);
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        guestCount: 90,
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
        packageId,
        upsertServices: [{ customName: "Acoustic duo", hours: 3 }],
        removeServices: ["Face painting"],
      },
    },
  ]);
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);

    return isAssistantPrompt(args[0].prompt) &&
      result.finishReason.unified === "stop"
      ? {
          ...result,
          content: [{ type: "text", text: '{"unexpected":true}' }],
        }
      : result;
  };
  const review = await send(
    id,
    "Make it 90, on December 12, 2099, Manila time. Contact Test Person at 09123456789. Switch to the Private package marker, make the acoustic duo three hours, and remove face painting.",
  );
  assert.match(
    review.assistantMessage?.body ?? "",
    /Should I send this request to AMAC for review\?/,
  );
  assert.equal(review.assistantError, null);
  assert.equal(review.assistantMessage?.suggestedReplies, undefined);
  const row = await db
    .selectFrom("conversations as c")
    .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
    .select(["b.id", "b.event_type", "b.guest_count", "b.submitted_at"])
    .where("c.id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(row.event_type, "Birthday");
  assert.equal(row.id, initial.id);
  assert.equal(row.guest_count, 90);
  assert.equal(row.submitted_at, null);
  assert.match(review.assistantMessage?.body ?? "", /Private package marker/u);
  assert.match(review.assistantMessage?.body ?? "", /Acoustic duo · 3 hours/u);
  assert.doesNotMatch(review.assistantMessage?.body ?? "", /Face painting/u);
  const requestId = randomUUID();
  const request = {
    conversationId: id,
    requestId,
    reviewMessageId: review.assistantMessage!.id,
    body: "Yep, go ahead!",
  };
  useConsent();
  const response = await call(
    "/messages/conversation/messages",
    customer.cookie,
    request,
  );
  assert.equal(response.status, 201);
  const submitted = customerMessageResultSchema.parse(await response.json());
  assert.match(submitted.assistantMessage?.body ?? "", /submitted/i);
  assert.match(
    submitted.assistantMessage?.body ?? "",
    /message AMAC staff here in this chat/u,
  );

  const savedBooking = () =>
    db
      .selectFrom("booking_requests")
      .selectAll()
      .where("id", "=", row.id)
      .executeTakeFirstOrThrow();

  const saved = await savedBooking();
  assert.ok(saved.submitted_at);
  assert.equal(saved.package_id, packageId);
  assert.doesNotMatch(
    JSON.stringify(saved.requested_services),
    /Face painting/u,
  );
  const audit = await db
    .selectFrom("ai_tool_calls")
    .select(["tool_name", "status"])
    .where("customer_message_id", "=", requestId)
    .orderBy("started_at")
    .execute();
  assert.deepEqual(audit, [
    { tool_name: "assessBookingConsent", status: "succeeded" },
    { tool_name: "submitBookingRequest", status: "succeeded" },
  ]);
  const modelCalls = model.doGenerateCalls.length;
  assert.equal(modelCalls, 1);
  const replay = await call(
    "/messages/conversation/messages",
    customer.cookie,
    request,
  );
  assert.equal(replay.status, 201);
  const replayed = customerMessageResultSchema.parse(await replay.json());
  assert.equal(replayed.assistantMessage?.id, submitted.assistantMessage?.id);
  assert.equal(model.doGenerateCalls.length, modelCalls);

  const change =
    "Please choose a different package and remove the acoustic duo.";
  useToolCalls([
    {
      toolName: "requestHumanHandoff",
      input: { reason: "needs_admin_review", summary: change },
    },
  ]);
  const handoff = await send(id, change);
  assert.equal(handoff.assistantError, null);
  assert.equal(handoff.assistantMessage?.body, humanHandoffAcknowledgement);

  const tools = model.doGenerateCalls[0].tools?.map(({ name }) => name) ?? [];

  assert.ok(tools.includes("requestHumanHandoff"));
  assert.ok(!tools.includes("updateBookingDraft"));
  const staffThread = threadSchema.parse(
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
  );
  assert.equal(staffThread.conversation.bookingRequestId, row.id);
  assert.equal(staffThread.conversation.aiEnabled, false);
  assert.deepEqual(staffThread.conversation.aiHandoff, {
    reason: "needs_admin_review",
    summary: change,
    pending: true,
  });
  assert.deepEqual(await savedBooking(), saved);
});

test("confirmation retries after provider failure once and replays its receipt after takeover", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
      },
    },
  ]);
  const review = await send(id, "Please review my birthday request.");
  const request = {
    conversationId: id,
    requestId: randomUUID(),
    reviewMessageId: review.assistantMessage!.id,
    body: "Sige po, go na!",
  };
  useReply("unused");
  model.doGenerate = async () => {
    throw new Error("temporary provider failure");
  };
  const failed = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, request)
    ).json(),
  );
  assert.ok(failed.assistantError);
  useConsent("fil");
  const results = await Promise.all([
    call("/messages/conversation/messages", customer.cookie, request),
    call("/messages/conversation/messages", customer.cookie, request),
  ]);

  const [first, second] = await Promise.all(
    results.map(async (r) => customerMessageResultSchema.parse(await r.json())),
  );

  assert.match(first.assistantMessage?.body ?? "", /Naipadala/);
  assert.equal(first.assistantMessage?.id, second.assistantMessage?.id);
  const audit = await db
    .selectFrom("ai_tool_calls")
    .select("id")
    .where("customer_message_id", "=", request.requestId)
    .where("tool_name", "=", "submitBookingRequest")
    .execute();
  assert.equal(audit.length, 1);
  assert.equal((await setAi(id, false, 0)).status, 200);
  const after = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, request)
    ).json(),
  );
  assert.equal(after.assistantMessage?.id, first.assistantMessage?.id);
});

test("package shopping returns the catalog answer while saving complete event details", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
      },
    },
    { toolName: "searchPublicCatalog", input: { catalogType: "package" } },
  ]);
  const result = await send(
    id,
    "Find me a package for my birthday on December 12, 2099; contact Test Person at 09123456789.",
  );
  assert.equal(result.assistantMessage?.body, "Catalog results are ready");
  const row = await db
    .selectFrom("conversations as c")
    .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
    .select(["b.event_type", "b.submitted_at"])
    .where("c.id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(row.event_type, "Birthday");
  assert.equal(row.submitted_at, null);
});

test("an invalid package selection does not produce a misleading review", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
      },
    },
  ]);
  await send(id, "Please review my event details.");
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: { packageId: randomUUID(), guestCount: 80 },
    },
  ]);
  const result = await send(
    id,
    "Choose this package and update the guest count to 80.",
  );
  assert.equal(result.assistantMessage?.body, "Catalog results are ready");
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("tool_name")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.deepEqual(
    calls.map((call) => call.tool_name),
    ["updateBookingDraft"],
  );
  const draft = await db
    .selectFrom("conversations as c")
    .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
    .select("b.guest_count")
    .where("c.id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(draft.guest_count, 80);
});

test("a long saved review can still be confirmed without overflowing model history", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
        upsertServices: Array.from({ length: 20 }, (_, i) => ({
          customName: `Service ${i}`,
          hours: null,
          notes: "x".repeat(3000),
        })),
      },
    },
  ]);
  const review = await send(
    id,
    "Review my event details and requested services.",
  );
  assert.ok((review.assistantMessage?.body.length ?? 0) > 50_000);
  useConsent();
  const response = await call(
    "/messages/conversation/messages",
    customer.cookie,
    {
      conversationId: id,
      requestId: randomUUID(),
      reviewMessageId: review.assistantMessage!.id,
      body: "Sounds good, please send it.",
    },
  );
  assert.equal(response.status, 201);
  const result = customerMessageResultSchema.parse(await response.json());
  assert.match(result.assistantMessage?.body ?? "", /submitted/i);
  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /x{50000}/,
  );
});

for (const sample of [
  {
    language: "English",
    details:
      "I want to request a birthday event for 90 guests on December 12, 2099. It is one day, Asia/Manila time. My contact name is Alex Rivera and my phone number is 09123456789. Please prepare my request for review.",
    confirm: "That looks good. Go ahead!",
  },
  {
    language: "Filipino",
    details:
      "Gusto kong mag-request ng birthday event para sa 90 bisita sa December 12, 2099. Isang araw lang, Asia/Manila na oras. Ang pangalan ko ay Alex Rivera at ang numero ko ay 09123456789. Pakihanda ang request ko para masuri.",
    confirm: "Sige, pakipadala na po.",
  },
]) {
  test(
    `live Gateway collects and submits a reviewed draft in ${sample.language}`,
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
        const id = await conversation();
        const review = await send(id, sample.details);
        assert.equal(review.assistantError, null);
        assert.ok(review.assistantMessage);
        const requestId = randomUUID();
        const response = await call(
          "/messages/conversation/messages",
          customer.cookie,
          {
            conversationId: id,
            requestId,
            reviewMessageId: review.assistantMessage.id,
            body: sample.confirm,
          },
        );
        assert.equal(response.status, 201);
        const result = customerMessageResultSchema.parse(await response.json());
        assert.equal(result.assistantError, null);
        const audit = await db
          .selectFrom("ai_tool_calls")
          .select(["tool_name", "status", "output"])
          .where("customer_message_id", "=", requestId)
          .where("tool_name", "=", "submitBookingRequest")
          .executeTakeFirst();
        assert.equal(audit?.status, "succeeded");
        assert.equal(
          (audit?.output as { status?: string } | undefined)?.status,
          "submitted",
        );
      } finally {
        globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider;
        process.env.TEXT_MODEL = modelId;
        process.env.AI_GATEWAY_API_KEY = "fixture-key";
      }
    },
  );
}

test("explicit package-search budget carries into a new draft but not after a clear", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "searchPublicCatalog",
      input: { catalogType: "package", maxPricePesos: 20000 },
    },
  ]);
  await send(id, "Which packages fit my package budget of up to PHP 20,000?");
  assert.equal(
    (
      await db
        .selectFrom("conversations")
        .select("booking_request_id")
        .where("id", "=", id)
        .executeTakeFirstOrThrow()
    ).booking_request_id,
    null,
  );
  useToolCalls([
    { toolName: "updateBookingDraft", input: { eventType: "Birthday" } },
  ]);
  await send(id, "I want to book a birthday event.");
  async function budget() {
    return (
      await db
        .selectFrom("conversations as c")
        .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
        .select("b.budget")
        .where("c.id", "=", id)
        .executeTakeFirstOrThrow()
    ).budget;
  }
  assert.equal(await budget(), "Package budget up to PHP 20,000");
  useToolCalls([{ toolName: "updateBookingDraft", input: { budget: null } }]);
  await send(id, "Clear my budget.");
  useToolCalls([{ toolName: "updateBookingDraft", input: { guestCount: 80 } }]);
  await send(id, "There will be 80 guests.");
  assert.equal(await budget(), null);
});

for (const sample of [
  {
    question: "Which package fits my ₱20k package budget?",
    expected: "Package budget up to ₱20k",
  },
  {
    question:
      "My maximum budget for the package is PHP 20,000. What are the options?",
    expected: "Package budget up to PHP 20,000",
  },
  {
    question:
      "My total event budget is PHP 20,000. What packages do you offer?",
    expected: null,
  },
  {
    question:
      "That is not my package budget of PHP 20,000. What packages do you offer?",
    expected: null,
  },
]) {
  test(`carry-forward respects scope for: ${sample.question}`, async () => {
    const id = await conversation();
    useToolCalls([
      {
        toolName: "searchPublicCatalog",
        input: { catalogType: "package", maxPricePesos: 20000 },
      },
    ]);
    await send(id, sample.question);
    useToolCalls([
      { toolName: "updateBookingDraft", input: { eventType: "Birthday" } },
    ]);
    await send(id, "I want to book a birthday.");
    const row = await db
      .selectFrom("conversations as c")
      .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
      .select("b.budget")
      .where("c.id", "=", id)
      .executeTakeFirstOrThrow();
    assert.equal(row.budget, sample.expected);
  });
}

test("a migrated oversized note does not hide other draft details from the model", async () => {
  const id = await conversation();
  useToolCalls([
    { toolName: "updateBookingDraft", input: { eventType: "Birthday" } },
  ]);
  await send(id, "Plan a birthday.");
  await sql`update booking_requests set special_requests = ${"x".repeat(5000)} where id = (select booking_request_id from conversations where id = ${id}::uuid)`.execute(
    db,
  );
  useReply("What would you like to change?");
  await send(id, "Show my saved event details.");
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(prompt, /Birthday/);
  assert.match(prompt, /specialRequests/);
});

test("an invalid consent decision cannot submit and the same saved reply can retry", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
      },
    },
  ]);
  const review = await send(id, "Review my birthday request.");
  const request = {
    conversationId: id,
    requestId: randomUUID(),
    reviewMessageId: review.assistantMessage!.id,
    body: "Sí, envíala por favor.",
  };
  useReply("Your request has been submitted.");
  const failed = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, request)
    ).json(),
  );
  assert.ok(failed.assistantError);
  assert.equal(failed.assistantMessage, null);
  assert.equal(model.doGenerateCalls[0].responseFormat?.type, "json");
  const failedDecision = await db
    .selectFrom("ai_tool_calls")
    .select(["tool_name", "status"])
    .where("customer_message_id", "=", request.requestId)
    .executeTakeFirstOrThrow();
  assert.deepEqual(failedDecision, {
    tool_name: "assessBookingConsent",
    status: "failed",
  });
  useReply(
    JSON.stringify({
      intent: "submit",
      receiptCopy: { style: "other", receipt: "Solicitud enviada." },
    }),
  );
  const invalidReceipt = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, request)
    ).json(),
  );
  assert.ok(invalidReceipt.assistantError);
  assert.equal(invalidReceipt.assistantMessage, null);
  useReply(
    JSON.stringify({
      intent: "submit",
      receiptCopy: {
        style: "other",
        receipt:
          "Envié tu solicitud [[reference]] al equipo de AMAC para que la revise. Tus fechas son preferencias.",
      },
    }),
  );
  const retried = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, request)
    ).json(),
  );
  assert.match(
    retried.assistantMessage?.body ?? "",
    /Envié tu solicitud (?!\[).+ al equipo de AMAC/u,
  );
});

test("a mixed approval and correction gets a new review and an old pin cannot authorize it", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
      },
    },
  ]);
  const first = await send(id, "Review my birthday request.");
  assert.ok(first.assistantMessage);
  useToolCalls(
    [{ toolName: "updateBookingDraft", input: { guestCount: 75 } }],
    undefined,
    "continue",
  );
  const corrected = await send(
    id,
    "Sige, pero 75 guests pala bago ipadala.",
    first.assistantMessage.id,
  );
  assert.match(corrected.assistantMessage?.body ?? "", /Guest count.*75/);
  assert.notEqual(corrected.assistantMessage?.id, first.assistantMessage.id);
  const correctedCalls = await db
    .selectFrom("ai_tool_calls")
    .select(["tool_name", "output"])
    .where("customer_message_id", "=", corrected.message.id)
    .orderBy("started_at")
    .execute();
  assert.deepEqual(
    correctedCalls.map((call) => call.tool_name),
    ["assessBookingConsent", "updateBookingDraft", "reviewBookingDraft"],
  );
  assert.deepEqual(correctedCalls[0].output, { intent: "continue" });

  const requestId = randomUUID();
  const request = {
    conversationId: id,
    requestId,
    reviewMessageId: first.assistantMessage.id,
    body: "Sige, go na!",
  };
  useReply("unused");
  model.doGenerate = async () => {
    throw new Error("temporary provider failure");
  };
  const failed = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, request)
    ).json(),
  );
  assert.ok(failed.assistantError);

  useToolCalls([{ toolName: "updateBookingDraft", input: {} }]);
  const replay = customerMessageResultSchema.parse(
    await (
      await call("/messages/conversation/messages", customer.cookie, {
        ...request,
        reviewMessageId: corrected.assistantMessage?.id,
      })
    ).json(),
  );
  assert.equal(replay.message.id, failed.message.id);
  assert.match(replay.assistantMessage?.body ?? "", /Guest count.*75/);
  assert.match(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /review_changed/,
  );
  assert.equal(
    model.doGenerateCalls.some(({ prompt }) => isConsentPrompt(prompt)),
    false,
  );
  const booking = await db
    .selectFrom("conversations as c")
    .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
    .select("b.submitted_at")
    .where("c.id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(booking.submitted_at, null);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("tool_name")
    .where("customer_message_id", "=", requestId)
    .execute();
  assert.deepEqual(calls.map((call) => call.tool_name).sort(), [
    "reviewBookingDraft",
    "updateBookingDraft",
  ]);
});

test("retry after a saved non-consent assessment cannot turn it into approval", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
      },
    },
  ]);
  const initial = await send(id, "Review my birthday request.");
  assert.ok(initial.assistantMessage);
  const request = {
    conversationId: id,
    requestId: randomUUID(),
    reviewMessageId: initial.assistantMessage.id,
    body: "Paano kung hindi pa sure yung venue?",
  };
  useReply(JSON.stringify({ intent: "continue" }));
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (input) => {
    if (!isConsentPrompt(input.prompt)) throw new Error("Reply unavailable");

    return generate(input);
  };

  const sendRequest = async () =>
    customerMessageResultSchema.parse(
      await (
        await call("/messages/conversation/messages", customer.cookie, request)
      ).json(),
    );

  const failed = await sendRequest();
  assert.ok(failed.assistantError);

  useReply("We can continue without choosing a venue yet.");
  const replay = await sendRequest();
  assert.equal(replay.assistantError, null);
  assert.equal(
    replay.assistantMessage?.body,
    "We can continue without choosing a venue yet.",
  );
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(isConsentPrompt(model.doGenerateCalls[0].prompt), false);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select(["tool_name", "output"])
    .where("customer_message_id", "=", request.requestId)
    .execute();
  assert.deepEqual(calls, [
    { tool_name: "assessBookingConsent", output: { intent: "continue" } },
  ]);
});

test("a catalog change while consent is being assessed requires another review", async () => {
  const id = await conversation();
  const selectedPackage = await detailPackage();
  await db
    .updateTable("packages")
    .set({ published_at: new Date() })
    .where("id", "=", selectedPackage)
    .execute();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
        packageId: selectedPackage,
      },
    },
  ]);
  const review = await send(
    id,
    "Review my birthday request with this package.",
  );
  assert.ok(review.assistantMessage);
  assert.match(review.assistantMessage.body, /1,250/);

  useToolCalls(
    [{ toolName: "updateBookingDraft", input: {} }],
    undefined,
    "continue",
  );
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (input) => {
    if (!isConsentPrompt(input.prompt)) return generate(input);

    await db
      .updateTable("packages")
      .set({ price: 1500 })
      .where("id", "=", selectedPackage)
      .execute();

    return {
      ...(await generate(input)),
      content: [
        {
          type: "text",
          text: JSON.stringify({
            intent: "submit",
            receiptCopy: { style: "en" },
          }),
        },
      ],
    };
  };
  const result = await send(id, "Please send it.", review.assistantMessage.id);
  assert.equal(result.assistantError, null);
  const audit = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .where("tool_name", "=", "submitBookingRequest")
    .executeTakeFirstOrThrow();
  assert.deepEqual(audit.output, { status: "review_changed" });
  assert.match(
    JSON.stringify(model.doGenerateCalls[1].prompt),
    /review_changed/,
  );
  const draft = await db
    .selectFrom("conversations as c")
    .innerJoin("booking_requests as b", "b.id", "c.booking_request_id")
    .select("b.submitted_at")
    .where("c.id", "=", id)
    .executeTakeFirstOrThrow();
  assert.equal(draft.submitted_at, null);
});

test("repeated large review summaries do not prevent corrections or confirmation", async () => {
  const id = await conversation();
  useToolCalls([
    {
      toolName: "updateBookingDraft",
      input: {
        eventType: "Birthday",
        durationMode: "one_day",
        requestedDates: ["2099-12-12"],
        timeZone: "Asia/Manila",
        contactName: "Test Person",
        phoneNumber: "09123456789",
        upsertServices: Array.from({ length: 14 }, (_, i) => ({
          customName: `Service ${i}`,
          hours: null,
          notes: "x".repeat(3000),
        })),
      },
    },
  ]);
  let review = await send(id, "Review my event and services.");

  for (let count = 50; count < 56; count++) {
    useToolCalls([
      { toolName: "updateBookingDraft", input: { guestCount: count } },
    ]);
    review = await send(id, `Change guest count to ${count}.`);
    assert.equal(review.assistantError, null);
    assert.match(
      review.assistantMessage?.body ?? "",
      /Should I send this request to AMAC for review\?/,
    );
  }

  useConsent();
  const response = await call(
    "/messages/conversation/messages",
    customer.cookie,
    {
      conversationId: id,
      requestId: randomUUID(),
      reviewMessageId: review.assistantMessage!.id,
      body: "Go ahead!",
    },
  );
  const result = customerMessageResultSchema.parse(await response.json());
  assert.match(result.assistantMessage?.body ?? "", /submitted/i);
});

test("raw tool markup is retried once as native tools and never saved", async () => {
  useReply("I checked the business information.");
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);

    if (model.doGenerateCalls.length === 1)
      return {
        ...result,
        content: [{ type: "text", text: "<｜｜DSML｜｜ calls>" }],
      };

    if (model.doGenerateCalls.length === 2)
      return {
        ...result,
        content: [
          {
            type: "tool-call",
            toolCallId: "native-retry",
            toolName: "getBusinessInformation",
            input: "{}",
          },
        ],
        finishReason: { unified: "tool-calls", raw: undefined },
      };

    return result;
  };
  const result = await send(
    await conversation(),
    "What is AMAC's business information?",
  );
  assert.equal(result.assistantError, null);
  assert.doesNotMatch(result.assistantMessage?.body ?? "", /DSML/);
  assert.equal(model.doGenerateCalls.length, 3);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("tool_name")
    .where("customer_message_id", "=", result.message.id)
    .execute();
  assert.deepEqual(
    calls.map((call) => call.tool_name),
    ["getBusinessInformation"],
  );
});

test("raw protocol after a draft mutation does not replay the mutation", async () => {
  useToolCalls([
    { toolName: "updateBookingDraft", input: { eventType: "Birthday" } },
  ]);
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);

    return model.doGenerateCalls.length === 2
      ? { ...result, content: [{ type: "text", text: "<｜｜DSML｜｜ calls>" }] }
      : result;
  };
  const id = await conversation();
  const result = await send(id, "Please plan a birthday.");
  assert.ok(result.assistantError);
  assert.equal(model.doGenerateCalls.length, 2);
  const calls = await db
    .selectFrom("ai_tool_calls")
    .select("tool_name")
    .where("customer_message_id", "=", result.message.id)
    .where("tool_name", "=", "updateBookingDraft")
    .execute();
  assert.equal(calls.length, 1);
});

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

async function assertReadToolAudit(
  result: Awaited<ReturnType<typeof send>>,
  toolName:
    "getLatestQuotation" | "getBookingDetails" | "getBusinessInformation",
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

function modelToolOutput(
  toolName: "getLatestQuotation" | "getBookingDetails" | "updateBookingDraft",
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

test("sending a quotation while AI is generating lets the reply finish", async () => {
  const { id, bookingId } = await bookingFactsConversation();
  useToolCalls([{ toolName: "getLatestQuotation", input: {} }], async () => {
    await deliverBookingFactQuotation(bookingId, "Transport", 27500);
  });

  const reply = await send(id, "Has my quotation been sent?");
  assert.ok(reply.assistantMessage);
  assert.equal(reply.assistantError, null);
  const thread = threadSchema.parse(
    await (await call(`/admin/conversations/${id}`, team.cookie)).json(),
  );
  assert.equal(thread.conversation.aiEnabled, true);
  assert.equal(thread.conversation.aiVersion, 0);
  assert.deepEqual(
    thread.messages.map((message) => message.senderRole),
    ["customer", "admin", "assistant"],
  );
});

test("quotation follow-up gets the latest delivered version only and audits the read", async () => {
  const { id, bookingId } = await bookingFactsConversation();
  const toolName = "getLatestQuotation";
  const first = await deliverBookingFactQuotation(
    bookingId,
    "Old transport fee",
    27500,
  );

  useToolCalls([{ toolName, input: {} }]);
  const original = await send(id, "What was the total of my sent quotation?");
  await assertReadToolAudit(original, toolName, {
    status: "found",
    version: first.version,
    sentAt: first.sentAt,
  });

  const latest = await deliverBookingFactQuotation(
    bookingId,
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

  assert.deepEqual(modelToolOutput(toolName), {
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
  await assertReadToolAudit(revised, toolName, {
    status: "found",
    version: latest.version,
    sentAt: latest.sentAt,
  });
});

test("status follow-up gets only the latest change and audits it without the reason", async () => {
  const { id, bookingId } = await bookingFactsConversation();
  const toolName = "getBookingDetails";
  const reason = "Please send your reception start time.";
  await updateBookingFactStatus(bookingId, "needs_details", reason);
  useToolCalls([{ toolName, input: {} }]);
  const original = await send(id, "Why does it say Needs details?");
  const firstChange = await latestBookingStatusTimestamp(bookingId);
  const firstOutput = modelToolOutput(toolName) as {
    status: string;
    bookingRequest: {
      status: string;
      eventType: string;
      guestCount: number;
      timeZone: string;
      requestedDays: unknown[];
      selectedCatalogPackage: unknown;
      requestedServices: unknown[];
    };
    latestChange: unknown;
  };
  assert.equal(firstOutput.status, "found");
  assert.equal(firstOutput.bookingRequest.status, "needs_details");
  assert.equal(firstOutput.bookingRequest.eventType, "Wedding");
  assert.equal(firstOutput.bookingRequest.guestCount, 75);
  assert.equal(firstOutput.bookingRequest.timeZone, "Asia/Tokyo");
  assert.deepEqual(firstOutput.bookingRequest.requestedDays, [
    {
      date: "2099-01-01",
      startsAt: null,
      endsAt: null,
      operationalSchedule: null,
    },
    {
      date: "2099-01-03",
      startsAt: null,
      endsAt: null,
      operationalSchedule: null,
    },
  ]);
  assert.deepEqual(firstOutput.bookingRequest.selectedCatalogPackage, {
    name: "Private package marker",
    maxGuests: 100,
    pricePesos: 1000,
  });
  assert.deepEqual(firstOutput.bookingRequest.requestedServices, []);
  assert.deepEqual(firstOutput.latestChange, {
    status: "needs_details",
    reason,
    createdAt: firstChange,
  });
  await assertReadToolAudit(original, toolName, {
    status: "found",
    requestStatus: "needs_details",
    latestChangeStatus: "needs_details",
    changedAt: firstChange,
  });

  const latestReason = "The venue layout was reviewed.";
  await db
    .updateTable("booking_requests")
    .set({
      guest_count: 92,
      preferred_venue_location: "Updated garden",
      requested_services: JSON.stringify([
        {
          name: "Lighting",
          id: randomUUID(),
          serviceId: randomUUID(),
          hours: null,
          notes: null,
          included: false,
          updatedAt: null,
          offer: {
            totalHours: 4,
            fixedPricePesos: 2200,
            includedHours: 3,
            hourlyRatePesos: 500,
          },
        },
        {
          name: "Host",
          serviceId: null,
          hours: null,
          notes: null,
          included: false,
          updatedAt: null,
        },
      ]),
    })
    .where("id", "=", bookingId)
    .execute();
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
  const updatedOutput = modelToolOutput(toolName) as {
    status: string;
    bookingRequest: {
      status: string;
      guestCount: number;
      preferredVenueLocation: string;
      requestedServices: unknown[];
    };
    latestChange: unknown;
  };
  assert.equal(updatedOutput.status, "found");
  assert.equal(updatedOutput.bookingRequest.status, "accepted");
  assert.equal(updatedOutput.bookingRequest.guestCount, 92);
  assert.equal(
    updatedOutput.bookingRequest.preferredVenueLocation,
    "Updated garden",
  );
  assert.deepEqual(updatedOutput.bookingRequest.requestedServices, [
    {
      name: "Lighting",
      hours: null,
      notes: null,
      included: false,
      offer: {
        totalHours: 4,
        fixedPricePesos: 2200,
        includedHours: 3,
        hourlyRatePesos: 500,
        amountPesos: 2700,
      },
    },
    { name: "Host", hours: null, notes: null, included: false },
  ]);
  assert.doesNotMatch(
    JSON.stringify(updatedOutput),
    /private-phone-marker|Private contact marker|customerId|bookingRequestId/,
  );
  assert.deepEqual(updatedOutput.latestChange, {
    status: "accepted",
    reason: latestReason,
    createdAt: latestChange,
  });
  await assertReadToolAudit(updated, toolName, {
    status: "found",
    requestStatus: "accepted",
    latestChangeStatus: "accepted",
    changedAt: latestChange,
  });
});

test("booking reads distinguish unlinked, unsent, and missing status history", async () => {
  const unlinked = await conversation();
  const linked = await bookingFactsConversation();
  const calls = [
    { toolName: "getLatestQuotation", input: {} },
    { toolName: "getBookingDetails", input: {} },
  ] as const;

  for (const { id, statuses } of [
    { id: unlinked, statuses: ["no_linked_request", "no_linked_request"] },
    { id: linked.id, statuses: ["no_sent_quotation", "found"] },
  ]) {
    useToolCalls([...calls]);
    const result = await send(
      id,
      "What's my latest quotation and when did my inquiry status change?",
    );

    for (const [index, { toolName }] of calls.entries()) {
      const expected = { status: statuses[index] };
      const output = modelToolOutput(toolName) as {
        status: string;
        bookingRequest?: { requestedServices: unknown[] };
        latestChange?: unknown;
      };
      assert.equal(output.status, expected.status);

      if (toolName === "getBookingDetails" && expected.status === "found") {
        assert.deepEqual(output.bookingRequest?.requestedServices, []);
        assert.equal(output.latestChange, null);
      } else assert.deepEqual(output, expected);

      await assertReadToolAudit(
        result,
        toolName,
        toolName === "getBookingDetails" && expected.status === "found"
          ? {
              status: "found",
              requestStatus: "under_review",
              latestChangeStatus: null,
              changedAt: null,
            }
          : expected,
      );
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
        "Transport",
        27500,
      );
      const firstReply = await assertReadToolAudit(
        await send(id, "What is the total on the quotation AMAC sent me?"),
        "getLatestQuotation",
        { status: "found", version: first.version, sentAt: first.sentAt },
      );
      assert.match(firstReply, /(?<![\d,])1,?275(?!\d|,\d|\.\d*[1-9])/);
      assert.match(firstReply, /₱|\bPHP\b|\bpesos?\b/i);

      const latest = await deliverBookingFactQuotation(
        bookingId,
        "Garden lighting",
        87542,
      );
      const revisedReply = await assertReadToolAudit(
        await send(
          id,
          "And what's the total now, and what is the extra charge for?",
        ),
        "getLatestQuotation",
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

      await db
        .updateTable("booking_requests")
        .set({
          requested_services: JSON.stringify([
            {
              name: "Lighting",
              id: randomUUID(),
              serviceId: randomUUID(),
              hours: null,
              notes: null,
              included: false,
              updatedAt: null,
              offer: {
                totalHours: 4,
                fixedPricePesos: 2200,
                includedHours: 3,
                hourlyRatePesos: 500,
              },
            },
            {
              name: "Host",
              serviceId: null,
              hours: null,
              notes: null,
              included: false,
              updatedAt: null,
            },
          ]),
        })
        .where("id", "=", bookingId)
        .execute();
      const detailsReply = await assertReadToolAudit(
        await send(
          id,
          "What are the saved Lighting and Host add-ons on my booking? Is there a price for Host yet?",
        ),
        "getBookingDetails",
        {
          status: "found",
          requestStatus: "under_review",
          latestChangeStatus: null,
          changedAt: null,
        },
      );
      assert.match(detailsReply, /host/i);
      assert.match(
        detailsReply,
        /(?:host[\s\S]{0,150}(?:no|not|without|unpriced|pending|yet)|(?:no|not|without|unpriced|pending)[\s\S]{0,100}host)/i,
      );
      const addonTotal = await assertReadToolAudit(
        await send(id, "And what's the Lighting total?"),
        "getBookingDetails",
        {
          status: "found",
          requestStatus: "under_review",
          latestChangeStatus: null,
          changedAt: null,
        },
      );
      assert.match(addonTotal, /2,?700/);
      assert.doesNotMatch(addonTotal, /1,?875\.42/);

      const quoteReply = await assertReadToolAudit(
        await send(
          id,
          "Separately, what total was on my latest sent quotation?",
        ),
        "getLatestQuotation",
        { status: "found", version: latest.version, sentAt: latest.sentAt },
      );
      assert.match(quoteReply, /1,?875\.42/);

      await updateBookingFactStatus(
        bookingId,
        "needs_details",
        "Please provide the reception start time.",
      );
      const statusReply = await assertReadToolAudit(
        await send(id, "It says Needs details. What does AMAC need from me?"),
        "getBookingDetails",
        {
          status: "found",
          requestStatus: "needs_details",
          latestChangeStatus: "needs_details",
          changedAt: await latestBookingStatusTimestamp(bookingId),
        },
      );
      assert.match(statusReply, /(?:reception|start).{0,35}time/i);

      await updateBookingFactStatus(
        bookingId,
        "accepted",
        "The venue layout was reviewed.",
      );
      const updatedReply = await assertReadToolAudit(
        await send(id, "I see it changed again. What was the latest reason?"),
        "getBookingDetails",
        {
          status: "found",
          requestStatus: "accepted",
          latestChangeStatus: "accepted",
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

test(
  "live AMAC model rereads business information across changes and removal",
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

    const firstEmail = `first-${randomUUID()}@example.test`;
    const latestEmail = `latest-${randomUUID()}@example.test`;

    try {
      await pool.query("DELETE FROM business_information WHERE id = 1");
      await pool.query(
        "INSERT INTO business_information (id, information) VALUES (1, $1)",
        [JSON.stringify({ contact: { email: firstEmail } })],
      );
      const id = await conversation();
      const firstReply = await assertReadToolAudit(
        await send(id, "What's your current email address?"),
        "getBusinessInformation",
        { status: "found", fields: ["email"] },
      );
      assert.ok(
        firstReply.includes(firstEmail),
        `Expected current email in reply: ${firstReply}`,
      );

      await pool.query(
        "UPDATE business_information SET information = $1 WHERE id = 1",
        [JSON.stringify({ contact: { email: latestEmail } })],
      );
      const updatedReply = await assertReadToolAudit(
        await send(id, "Has your email changed? What is it now?"),
        "getBusinessInformation",
        { status: "found", fields: ["email"] },
      );
      assert.ok(
        updatedReply.includes(latestEmail),
        `Expected updated email in reply: ${updatedReply}`,
      );

      await pool.query("DELETE FROM business_information WHERE id = 1");
      const missingReply = await assertReadToolAudit(
        await send(
          id,
          "Please check again: what is your current email address?",
        ),
        "getBusinessInformation",
        { status: "not_configured", fields: [] },
      );
      assert.match(missingReply, /email|address/i);
      assert.match(
        missingReply,
        /not|unavailable|unlisted|no longer|cannot|can't|unable/i,
      );
      assert.ok(
        !missingReply.includes(firstEmail) &&
          !missingReply.includes(latestEmail),
        `Removed emails must not appear in reply: ${missingReply}`,
      );
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

test("catalog tool identifies package guest capacity as a maximum", async () => {
  const marker = randomUUID();
  await db
    .insertInto("packages")
    .values({
      name: `Capacity fixture ${marker}`,
      slug: `capacity-${marker}`,
      price: 33333,
      max_guests: 123,
      published_at: new Date(),
    })
    .execute();
  useCatalogCalls([
    {
      catalogType: "package",
      minPricePesos: 33333,
      maxPricePesos: 33333,
      pax: 80,
    },
  ]);
  const result = await send(
    await conversation(),
    "Find a package for 80 guests.",
  );
  assert.equal(result.assistantError, null);
  const toolOutput = JSON.stringify(model.doGenerateCalls[1].prompt);
  assert.match(toolOutput, /maximumGuestCapacity/);
  assert.match(toolOutput, /123/);
  assert.doesNotMatch(toolOutput, /minimumGuestCapacity/);
});

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
  assert.match(part.output.value, /Maximum guest capacity: 80 guests/);
  const record = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("customer_message_id", "=", result.message.id)
    .executeTakeFirstOrThrow();
  assert.equal(record.tool_name, "getPublicCatalogItem");
  assert.equal(record.status, "succeeded");
  assert.equal(record.assistant_message_id, result.assistantMessage.id);
  assert.deepEqual(record.output, {
    markdown: part.output.value.replace(
      "Maximum guest capacity: 80 guests",
      "Capacity: 80 guests",
    ),
    nextCursor: null,
  });
});

test("the assistant can attach three cards but cannot attach a fourth verified item", async () => {
  const price = 73919;
  const names = ["Garden", "Coastal", "Ballroom", "Civil"];

  const packages = names
    .map((name) => ({
      id: randomUUID(),
      name: `${name} wedding fixture`,
      slug: `${name.toLowerCase()}-${randomUUID()}`,
      description: "Public wedding package for a catalog browsing test",
      price,
      max_guests: 120,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  await db.insertInto("packages").values(packages).execute();

  const selections = packages.map(({ id }) => ({ catalogType: "package", id }));

  const shown = selections.slice(0, 3).reverse();

  useToolRounds(
    [
      [
        {
          toolName: "searchPublicCatalog",
          input: {
            catalogType: "package",
            minPricePesos: price,
            maxPricePesos: price,
          },
        },
        { toolName: "getPublicCatalogItem", input: selections[3] },
      ],
      [
        {
          toolName: "attachCatalogRecommendations",
          input: { items: selections },
        },
      ],
      [
        {
          toolName: "attachCatalogRecommendations",
          input: { items: shown },
        },
      ],
    ],
    undefined,
    undefined,
    "Here are three wedding packages you can browse. How many guests are you expecting?",
  );

  const id = await conversation();
  const response = await send(id, "Show me wedding packages");
  assert.equal(response.assistantError, null);
  const reply = response.assistantMessage;
  assert.ok(reply?.catalogRecommendations, "Expected three attached cards");
  assert.deepEqual(
    reply.catalogRecommendations.map((item) => item.id),
    shown.map((item) => item.id),
  );
  const lookups = await db
    .selectFrom("ai_tool_calls")
    .select(["tool_name", "status", "input"])
    .where("customer_message_id", "=", response.message.id)
    .execute();
  assert.ok(
    lookups.some(
      (call) =>
        call.tool_name === "getPublicCatalogItem" &&
        call.status === "succeeded",
    ),
    "Expected a verified fourth package",
  );
  assert.deepEqual(
    lookups.filter(
      ({ tool_name }) => tool_name === "attachCatalogRecommendations",
    ),
    [
      {
        tool_name: "attachCatalogRecommendations",
        status: "succeeded",
        input: { items: shown },
      },
    ],
  );

  const thread = threadSchema.parse(
    await (await call(`/messages/conversations/${id}`, customer.cookie)).json(),
  );
  assert.deepEqual(
    thread.messages.at(-1)?.catalogRecommendations,
    reply.catalogRecommendations,
  );

  useReply("I can tell you about the second package.");
  await send(id, "Which is the second one?");
  const { context } = turnContext(0);
  assert.ok("previousCatalogRecommendations" in context);
  assert.deepEqual(context.previousCatalogRecommendations, {
    replyId: reply.id,
    shownItems: packages
      .slice(0, 3)
      .reverse()
      .map(({ id, name }) => ({ id, type: "package", name })),
  });
});

test("saved four- and five-card messages still reload and ground ordinal follow-ups", async () => {
  for (const count of [4, 5]) {
    const cards = Array.from({ length: count }, (_, index) => ({
      id: randomUUID(),
      type: "service" as const,
      name: `Historical service ${index + 1}`,
      slug: `historical-service-${index + 1}`,
      description: "Saved catalog preview",
      imageUrl: null,
      fixedPricePesos: null,
      hourlyRatePesos: 1200,
      includedHours: null,
    })) satisfies CatalogRecommendation[];

    const id = await conversation();
    useReply("Here are some options.");
    const { message, assistantMessage } = await send(id, "Show me services");
    assert.ok(assistantMessage);

    const shownItems = cards.map(({ id, type, name }) => ({ id, type, name }));

    await db
      .updateTable("messages")
      .set({ catalog_recommendations: sql`${JSON.stringify(cards)}::jsonb` })
      .where("id", "=", assistantMessage.id)
      .executeTakeFirstOrThrow();
    await db
      .insertInto("ai_tool_calls")
      .values({
        turn_id: randomUUID(),
        tool_call_id: "historical-recommendations",
        tool_name: "attachCatalogRecommendations",
        customer_message_id: message.id,
        assistant_message_id: assistantMessage.id,
        status: "succeeded",
        completed_at: sql`now()`,
        input: sql`${JSON.stringify({ items: cards.map(({ id, type }) => ({ id, catalogType: type })) })}::jsonb`,
        output: sql`${JSON.stringify({ status: "attached", items: shownItems })}::jsonb`,
      })
      .execute();

    const thread = threadSchema.parse(
      await (
        await call(`/messages/conversations/${id}`, customer.cookie)
      ).json(),
    );
    assert.deepEqual(thread.messages.at(-1)?.catalogRecommendations, cards);

    useReply("I can tell you about that service.");
    const followUp = await send(id, "Tell me about the last one.");
    assert.equal(followUp.assistantError, null);
    const { context } = turnContext(0);
    assert.ok("previousCatalogRecommendations" in context);
    assert.deepEqual(context.previousCatalogRecommendations, {
      replyId: assistantMessage.id,
      shownItems,
    });
  }
});

test("mixed recommendations save in the displayed order and ground ordinal follow-ups", async () => {
  const packageId = await detailPackage();
  const service = await db
    .insertInto("services")
    .values({
      name: "Fixture sound service",
      slug: `sound-${randomUUID()}`,
      description: "Sound setup and operation",
      hourly_rate_pesos: 1237,
    })
    .returning(["id", "name"])
    .executeTakeFirstOrThrow();
  const canvas = [
    {
      id: randomUUID(),
      title: "Package inclusions",
      widgets: [
        {
          id: randomUUID(),
          type: "service",
          x: 0,
          y: 0,
          w: 6,
          h: 4,
          markdown: "",
          mediaId: null,
          alt: "",
          caption: "",
          autoplay: false,
          serviceId: service.id,
          serviceTerms: { includedHours: 2, hourlyRatePesos: 425 },
        },
      ],
    },
  ];
  await db
    .updateTable("packages")
    .set({ canvas: sql`${JSON.stringify(canvas)}::jsonb` })
    .where("id", "=", packageId)
    .execute();
  const items = [
    { catalogType: "service", id: service.id },
    { catalogType: "package", id: packageId },
  ];
  useToolRounds(
    [
      [
        {
          toolName: "searchPublicCatalog",
          input: {
            catalogType: "service",
            minPricePesos: 1237,
            maxPricePesos: 1237,
            pricingType: "hourly",
          },
        },
      ],
      [{ toolName: "getPublicCatalogItem", input: items[1] }],
      [
        { toolName: "attachCatalogRecommendations", input: { items } },
        {
          toolName: "attachCatalogRecommendations",
          input: { items: [...items].reverse() },
        },
      ],
    ],
    undefined,
    undefined,
    "These are the options I recommend.",
    ["Tell me about the first option"],
  );
  const id = await conversation();
  const result = await send(id, "Recommend a package and a sound service");
  assert.equal(result.assistantError, null);
  const reply = result.assistantMessage;
  assert.ok(reply?.catalogRecommendations);
  assert.deepEqual(reply.suggestedReplies, ["Tell me about the first option"]);
  const [serviceCard, packageCard] = reply.catalogRecommendations;
  assert.ok(serviceCard.type === "service" && packageCard.type === "package");
  assert.equal(serviceCard.id, service.id);
  assert.equal(serviceCard.hourlyRatePesos, 1237);
  assert.equal(packageCard.id, packageId);
  assert.deepEqual(packageCard.inclusions, [
    { name: service.name, includedHours: 2, hourlyRatePesos: 425 },
  ]);
  assert.match(
    JSON.stringify(model.doGenerateCalls[2].prompt),
    /Included hours: 2/,
  );
  assert.match(
    JSON.stringify(model.doGenerateCalls[3].prompt),
    /already_attached/,
  );

  const persisted = await db
    .selectFrom("messages")
    .select("catalog_recommendations")
    .where("id", "=", reply.id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(
    persisted.catalog_recommendations,
    reply.catalogRecommendations,
  );
  const thread = threadSchema.parse(
    await (await call(`/messages/conversations/${id}`, customer.cookie)).json(),
  );
  assert.deepEqual(
    thread.messages.at(-1)?.catalogRecommendations,
    reply.catalogRecommendations,
  );

  useToolCalls([
    { toolName: "attachCatalogRecommendations", input: { items } },
  ]);
  const followUp = await send(id, "Tell me about the second one");
  assert.equal(followUp.assistantError, null);
  assert.equal(followUp.assistantMessage?.catalogRecommendations, undefined);
  const { context } = turnContext(0);
  assert.ok("previousCatalogRecommendations" in context);
  assert.deepEqual(context.previousCatalogRecommendations, {
    replyId: reply.id,
    shownItems: [
      { id: service.id, type: "service", name: serviceCard.name },
      { id: packageId, type: "package", name: packageCard.name },
    ],
  });
  const rejected = await db
    .selectFrom("ai_tool_calls")
    .select(["status", "error_code"])
    .where("customer_message_id", "=", followUp.message.id)
    .executeTakeFirstOrThrow();
  assert.deepEqual(rejected, {
    status: "failed",
    error_code: "invalid_recommendations",
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

test("catalog and proposal lookups can exceed six operations in one turn", async () => {
  const id = await detailPackage();
  useToolCalls(
    Array.from({ length: 7 }, (_, index) =>
      index % 3 === 2
        ? { toolName: "getMyPackage", input: {} }
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
  assert.equal(calls.length, 7);
  assert.ok(calls.every((call) => call.status === "succeeded"));
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

for (const { name, outputTokens, expectedCalls } of [
  {
    name: "short tool calls can continue past six rounds",
    outputTokens: 1,
    expectedCalls: 7,
  },
  {
    name: "long generations reserve output tokens for the answer",
    outputTokens: 800,
    expectedCalls: 3,
  },
]) {
  test(name, async () => {
    useReply("Here are the available catalog choices");
    const generate = model.doGenerate.bind(model);
    model.doGenerate = async (...args) => {
      const result = await generate(...args);
      const round = model.doGenerateCalls.length;
      if (round > 7 || args[0].toolChoice?.type === "none") return result;

      return {
        ...result,
        usage: {
          ...result.usage,
          outputTokens: { ...result.usage.outputTokens, total: outputTokens },
        },
        content: [
          {
            type: "tool-call",
            toolCallId: `step-${round}`,
            toolName: "searchPublicCatalog",
            input: JSON.stringify({
              catalogType: "package",
              minPricePesos: round,
            }),
          },
        ],
        finishReason: { unified: "tool-calls", raw: undefined },
      };
    };
    const result = await send(await conversation(), "Compare several searches");
    assert.equal(
      result.assistantMessage?.body,
      "Here are the available catalog choices",
    );
    const calls = await db
      .selectFrom("ai_tool_calls")
      .selectAll()
      .where("customer_message_id", "=", result.message.id)
      .execute();
    assert.equal(calls.length, expectedCalls);
    assert.equal(model.doGenerateCalls.length, expectedCalls + 1);
    assert.ok(
      calls.every(
        (call) =>
          call.status === "succeeded" &&
          call.assistant_message_id === result.assistantMessage?.id,
      ),
    );
  });
}

test("the agent reserves time for a final answer after a slow lookup", async (t) => {
  let elapsed = 0;
  const now = Date.now.bind(Date);
  t.mock.method(Date, "now", () => now() + elapsed);
  useCatalogCalls([{ catalogType: "package" }]);
  const generate = model.doGenerate.bind(model);
  model.doGenerate = async (...args) => {
    const result = await generate(...args);
    elapsed = 21_000;
    return result;
  };
  const result = await send(await conversation(), "Find packages");
  assert.equal(result.assistantError, null);
  assert.equal(result.assistantMessage?.body, "Catalog results are ready");
  assert.equal(model.doGenerateCalls.length, 2);
  assert.equal(model.doGenerateCalls[1].toolChoice?.type, "none");
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
    { toolName: "getLatestQuotation", input: { bookingId: foreignBooking } },
    { toolName: "getBookingDetails", input: { customerId: other.id } },
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
    { toolName: "getMyPackage", input: {} },
    { toolName: "getMyPackage", input: {} },
    { toolName: "getMyPackage", input: {} },
  ]);
  const result = await send(id, "What is my proposal?");
  assert.equal(result.assistantError, null);
  assert.ok(result.assistantMessage);

  const message = model.doGenerateCalls[1].prompt.find(
    (item) =>
      item.role === "tool" &&
      item.content.some(
        (part) =>
          part.type === "tool-result" && part.toolName === "getMyPackage",
      ),
  );

  assert.ok(message?.role === "tool");

  const part = message.content.find(
    (item) => item.type === "tool-result" && item.toolName === "getMyPackage",
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
    .where("tool_name", "=", "getMyPackage")
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
    assert.equal(record.tool_name, "getMyPackage");
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
  const proposal = await getMyPackageService({
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
  useToolCalls([{ toolName: "getMyPackage", input: {} }]);
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
          part.type === "tool-result" && part.toolName === "getMyPackage",
      ),
  );

  assert.ok(toolMessage?.role === "tool");

  const part = toolMessage.content.find(
    (item) => item.type === "tool-result" && item.toolName === "getMyPackage",
  );

  assert.ok(part && part.type === "tool-result" && part.output.type === "json");
  assert.deepEqual(part.output.value, JSON.parse(JSON.stringify(proposal)));
  const audit = await db
    .selectFrom("ai_tool_calls")
    .select(["status", "error_code"])
    .where("customer_message_id", "=", result.message.id)
    .where("tool_name", "=", "getMyPackage")
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
      toolName: "getMyPackage",
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
  useToolCalls([{ toolName: "getMyPackage", input: {} }], async () => {
    assert.equal((await setAi(id, false, 0)).status, 200);
  });
  const result = await send(id, "Read my proposal");
  assert.equal(result.assistantMessage, null);
  const records = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("tool_name", "=", "getMyPackage")
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
  useToolCalls([{ toolName: "getMyPackage", input: {} }]);
  const result = await send(id, "Read my proposal");
  assert.ok(result.assistantMessage);
  assert.equal(result.assistantError, null);
  const record = await db
    .selectFrom("ai_tool_calls")
    .selectAll()
    .where("tool_name", "=", "getMyPackage")
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
          toolName: "getMyPackage",
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
    .where("tool_name", "=", "getMyPackage")
    .executeTakeFirstOrThrow();
  assert.equal(reader.status, "succeeded");
  assert.equal(reader.assistant_message_id, second.assistantMessage.id);
});

test("business information reads current public fields and records only field names", async () => {
  const information = {
    name: "Clemora Events",
    introduction: "We plan celebrations.",
    phone: "+63 900 123 4567",
    email: "hello@example.test",
    facebook: "https://example.test/facebook",
    instagram: "https://example.test/instagram",
    address: "123 Event Street",
    mapUrl: "https://example.test/map",
    serviceAreas: "Metro Manila",
    openingHours: "Monday to Friday",
  };
  await pool.query("DELETE FROM business_information WHERE id = 1");
  const savedResponse = await app.request("/v1/admin/business-information", {
    method: "PUT",
    headers: { Cookie: team.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedUpdatedAt: null,
      information: {
        about: {
          name: information.name,
          introduction: information.introduction,
        },
        contact: {
          phone: information.phone,
          email: information.email,
          facebook: information.facebook,
          instagram: information.instagram,
        },
        location: {
          address: information.address,
          mapUrl: information.mapUrl,
          serviceAreas: information.serviceAreas,
        },
        hours: { supportHours: information.openingHours },
      },
    }),
  });
  assert.equal(savedResponse.status, 200);
  const saved = (await savedResponse.json()) as { updatedAt: string };
  const id = await conversation();
  useToolCalls([{ toolName: "getBusinessInformation", input: {} }]);
  const first = await send(id, "How can I contact you?");
  assert.deepEqual(publicLookupOutput("getBusinessInformation"), {
    type: "json",
    value: { status: "found", information },
  });
  await assertReadToolAudit(first, "getBusinessInformation", {
    status: "found",
    fields: Object.keys(information),
  });

  const updatedResponse = await app.request("/v1/admin/business-information", {
    method: "PUT",
    headers: { Cookie: team.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedUpdatedAt: saved.updatedAt,
      information: {
        about: { name: "Updated Events" },
        contact: { phone: "", email: "new@example.test" },
      },
    }),
  });
  assert.equal(updatedResponse.status, 200);
  useToolCalls([{ toolName: "getBusinessInformation", input: {} }]);
  await send(id, "Has your contact changed?");
  assert.deepEqual(publicLookupOutput("getBusinessInformation"), {
    type: "json",
    value: {
      status: "found",
      information: { name: "Updated Events", email: "new@example.test" },
    },
  });
});

function publicLookupOutput(
  toolName: "getBusinessInformation" | "searchSupportingDocuments",
) {
  for (const message of model.doGenerateCalls[1].prompt) {
    if (message.role !== "tool") continue;

    for (const part of message.content) {
      if (part.type !== "tool-result" || part.toolName !== toolName) continue;

      return part.output;
    }
  }

  assert.fail(`Missing tool result for ${toolName}`);
}

test("business information distinguishes absent and blank data from failures and rejects extra input", async () => {
  const id = await conversation();

  for (const information of [
    null,
    {},
    { about: { name: "  " }, contact: { email: "" } },
    { about: { tagline: "Legacy only" } },
  ]) {
    await pool.query("DELETE FROM business_information WHERE id = 1");

    if (information !== null)
      await pool.query(
        "INSERT INTO business_information (id, information) VALUES (1, $1)",
        [JSON.stringify(information)],
      );

    useToolCalls([{ toolName: "getBusinessInformation", input: {} }]);
    const result = await send(id, "What is your business information?");
    assert.deepEqual(publicLookupOutput("getBusinessInformation"), {
      type: "json",
      value: { status: "not_configured", information: {} },
    });
    await assertReadToolAudit(result, "getBusinessInformation", {
      status: "not_configured",
      fields: [],
    });

    if (information === null)
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM business_information",
          )
        ).rows[0].count,
        0,
      );
  }

  useToolCalls([
    { toolName: "getBusinessInformation", input: { unexpected: true } },
  ]);
  const invalid = await send(id, "Read business information");
  assert.equal(
    (
      await db
        .selectFrom("ai_tool_calls")
        .select("id")
        .where("customer_message_id", "=", invalid.message.id)
        .execute()
    ).length,
    0,
  );

  await pool.query(
    "ALTER TABLE business_information RENAME TO business_information_unavailable_test",
  );

  try {
    useToolCalls([{ toolName: "getBusinessInformation", input: {} }]);
    const failed = await send(id, "Read business information again");
    const output = publicLookupOutput("getBusinessInformation");
    assert.match(
      JSON.stringify(output),
      /could not verify|failed|unavailable/i,
    );
    assert.doesNotMatch(
      JSON.stringify(output),
      /business_information_unavailable_test|relation .* does not exist/i,
    );
    const audit = await db
      .selectFrom("ai_tool_calls")
      .selectAll()
      .where("customer_message_id", "=", failed.message.id)
      .executeTakeFirstOrThrow();
    assert.equal(audit.status, "failed");
    assert.equal(audit.error_code, "business_information_unavailable");
    assert.equal(audit.assistant_message_id, failed.assistantMessage?.id);
  } finally {
    await pool.query(
      "ALTER TABLE business_information_unavailable_test RENAME TO business_information",
    );
  }
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
      "attachCatalogRecommendations",
      "getBusinessInformation",
      "getMyPackage",
      "getBookingDetails",
      "getLatestQuotation",
      "getPublicCatalogItem",
      "requestHumanHandoff",
      "searchPublicCatalog",
      "searchSupportingDocuments",
      "updateBookingDraft",
      "updateConversationMemory",
    ].sort(),
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
      { toolName: "getMyPackage", input: {} },
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

test(
  "live Gateway walks through a Taglish booking, corrects the review and submits once",
  { skip: process.env.AMAC_LIVE_TOOL_TESTS !== "1" },
  async () => {
    assert.ok(liveModelId && liveGatewayKey);
    const previousProvider = globalThis.AI_SDK_DEFAULT_PROVIDER;
    process.env.TEXT_MODEL = liveModelId;
    process.env.AI_GATEWAY_API_KEY = liveGatewayKey;
    delete globalThis.AI_SDK_DEFAULT_PROVIDER;

    try {
      const conversationId = await conversation();
      let replyTo: string | undefined;
      async function chat(body: string, requestId = randomUUID()) {
        const response = await call(
          "/messages/conversation/messages",
          customer.cookie,
          {
            conversationId,
            requestId,
            body,
            reviewMessageId: replyTo,
          },
        );
        assert.equal(response.status, 201);
        const result = customerMessageResultSchema.parse(await response.json());
        assert.equal(result.assistantError, null);
        assert.ok(result.assistantMessage);
        replyTo = result.assistantMessage.id;

        return result.assistantMessage;
      }

      function saved() {
        return db
          .selectFrom("conversations as c")
          .innerJoin("booking_requests as b", "c.booking_request_id", "b.id")
          .select([
            "b.id",
            "b.guest_count",
            "b.submitted_at",
            "b.contact_name",
            "b.phone_number",
            "b.requested_days",
            "b.reference",
          ])
          .where("c.id", "=", conversationId)
          .executeTakeFirstOrThrow();
      }

      const first = await chat(
        "Birthday ni Mama, 50 guests, one day lang. Manila time kami.",
      );
      assert.equal(first.body.match(/\?/gu)?.length, 1, first.body);
      assert.match(
        first.body,
        /\b(ang|anong|ano|kailan|kelan|mo|ninyo|niyo|ba|po)\b/iu,
      );
      const asksFor = [
        /date|petsa|kailan|kelan|when/iu,
        /sino|pangalan|contact (?:person|name)|who/iu,
        /phone|number|numero|mobile|cell/iu,
      ];

      const question =
        first.body.split(/[.!\n]/u).find((part) => part.includes("?")) ??
        first.body;

      assert.equal(
        asksFor.filter((field) => field.test(question)).length,
        1,
        question,
      );
      const initial = await saved();
      assert.equal(initial.guest_count, 50);
      assert.equal(initial.contact_name, null);
      assert.equal(initial.phone_number, null);
      assert.equal(initial.submitted_at, null);

      const askPhone = await chat(
        "Sa July 11, 2099. Ako si Ana Cruz, ako ang contact.",
      );
      assert.equal(askPhone.body.match(/\?/gu)?.length, 1, askPhone.body);
      assert.match(askPhone.body, /phone|number|numero|mobile|cell/iu);
      const review = await chat("09123456789");
      assert.match(review.body, /2099\\?-07\\?-11/);
      assert.match(review.body, /09123456789/);
      assert.ok(review.body.trimEnd().endsWith("?"));
      assert.match(review.body, /\b(ko|na|mo|ba|pwede|gusto)\b/iu);
      assert.doesNotMatch(
        review.body,
        /oo, isumite|yes, submit|para sa pagsusuri|upang isumite/iu,
      );
      assert.equal((await saved()).submitted_at, null);

      const corrected = await chat(
        "Sige, pero July 12, 2099 na pala. Palitan muna yung date.",
      );
      assert.match(corrected.body, /2099\\?-07\\?-12/);
      assert.doesNotMatch(corrected.body, /2099\\?-07\\?-11/);
      const correctedRow = await saved();
      assert.equal(correctedRow.submitted_at, null);
      assert.equal(correctedRow.id, initial.id);

      const approvalId = randomUUID();
      const receipt = await chat("Sige, go na!", approvalId);
      const submitted = await saved();
      assert.equal(submitted.id, initial.id);
      assert.ok(submitted.submitted_at);
      assert.match(JSON.stringify(submitted.requested_days), /2099-07-12/);
      assert.ok(receipt.body.includes(submitted.reference));
      assert.match(receipt.body, /\b(na|sa|yung|ang|ko)\b/iu);

      replyTo = corrected.id;
      const replay = await chat("Sige, go na!", approvalId);
      assert.equal(replay.id, receipt.id);
      const history = await db
        .selectFrom("booking_request_status_history")
        .select("status")
        .where("booking_request_id", "=", submitted.id)
        .execute();
      assert.equal(history.length, 1);
    } finally {
      globalThis.AI_SDK_DEFAULT_PROVIDER = previousProvider;
      process.env.TEXT_MODEL = modelId;
      process.env.AI_GATEWAY_API_KEY = "fixture-key";
    }
  },
);

test("supporting document and business lookups reach the customer model and retain bounded audit evidence", async () => {
  const originalFetch = globalThis.fetch;
  const document = await db
    .insertInto("supporting_documents")
    .values({
      original_filename: "Venue handbook.pdf",
      storage_key: `${randomUUID()}.pdf`,
      mime_type: "application/pdf",
      byte_size: 500,
      file_sha256: "a".repeat(64),
      pipeline_version: "fixture",
      extraction_status: "complete",
      page_count: 6,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const vector = JSON.stringify([1, ...Array<number>(767).fill(0)]);
  await db
    .insertInto("supporting_document_chunks")
    .values(
      Array.from({ length: 6 }, (_, index) => ({
        document_id: document.id,
        ordinal: index + 1,
        page_start: index + 1,
        page_end: index + 1,
        heading_path: ["Venue", `Section ${index + 1}`],
        content_text: `Passage ${index + 1}`,
        content_hash: "b".repeat(64),
        embedding: sql<string>`${vector}`,
        embedding_model: "google/gemini-embedding-2",
        embedded_at: new Date(),
      })),
    )
    .execute();
  globalThis.fetch = async () =>
    Response.json({ embeddings: [JSON.parse(vector)], warnings: [] });
  try {
    useToolCalls([
      {
        toolName: "searchSupportingDocuments",
        input: { query: "venue access" },
      },
      { toolName: "getBusinessInformation", input: {} },
    ]);
    const result = await send(
      await conversation(),
      "What does the handbook say about access and what are your business details?",
    );
    assert.ok(result.assistantMessage);
    assert.ok(
      model.doGenerateCalls[0].tools?.some(
        ({ name }) => name === "searchSupportingDocuments",
      ),
    );
    const parts = model.doGenerateCalls[1].prompt.flatMap((message) =>
      message.role === "tool" ? message.content : [],
    );
    const documentPart = parts.find(
      (part) =>
        part.type === "tool-result" &&
        part.toolName === "searchSupportingDocuments",
    );
    assert.ok(
      documentPart &&
        documentPart.type === "tool-result" &&
        documentPart.output.type === "json",
    );
    const output = documentPart.output.value as {
      results: {
        filename: string;
        pageStart: number;
        pageEnd: number;
        headingPath: string[];
        text: string;
      }[];
    };
    assert.equal(output.results.length, 5);
    for (const passage of output.results) {
      assert.deepEqual(Object.keys(passage).sort(), [
        "filename",
        "headingPath",
        "pageEnd",
        "pageStart",
        "text",
      ]);
      assert.equal(passage.filename, "Venue handbook.pdf");
      assert.equal(passage.pageStart, passage.pageEnd);
      assert.deepEqual(passage.headingPath, [
        "Venue",
        `Section ${passage.pageStart}`,
      ]);
      assert.equal(passage.text, `Passage ${passage.pageStart}`);
    }
    assert.ok(
      parts.some(
        (part) =>
          part.type === "tool-result" &&
          part.toolName === "getBusinessInformation",
      ),
    );
    const calls = await db
      .selectFrom("ai_tool_calls")
      .selectAll()
      .where("customer_message_id", "=", result.message.id)
      .execute();
    assert.deepEqual(calls.map((call) => call.tool_name).sort(), [
      "getBusinessInformation",
      "searchSupportingDocuments",
    ]);
    assert.ok(
      calls.every(
        (call) =>
          call.status === "succeeded" &&
          call.assistant_message_id === result.assistantMessage?.id,
      ),
    );
    const audit = calls.find(
      (call) => call.tool_name === "searchSupportingDocuments",
    )!;
    assert.deepEqual(audit.input, { query: "venue access" });
    assert.equal((audit.output as { matches: unknown[] }).matches.length, 5);
    assert.doesNotMatch(JSON.stringify(audit.output), /Passage|Venue handbook/);
  } finally {
    globalThis.fetch = originalFetch;
    await db
      .deleteFrom("supporting_documents")
      .where("id", "=", document.id)
      .execute();
  }
});

test("supporting document lookup distinguishes no matches from an unavailable provider", async () => {
  const originalFetch = globalThis.fetch;
  const vector = [1, ...Array<number>(767).fill(0)];
  try {
    globalThis.fetch = async () =>
      Response.json({ embeddings: [vector], warnings: [] });
    useToolCalls([
      {
        toolName: "searchSupportingDocuments",
        input: { query: "no matching document" },
      },
    ]);
    const empty = await send(await conversation(), "Search the handbook");
    assert.deepEqual(publicLookupOutput("searchSupportingDocuments"), {
      type: "json",
      value: { results: [] },
    });
    const emptyAudit = await db
      .selectFrom("ai_tool_calls")
      .selectAll()
      .where("customer_message_id", "=", empty.message.id)
      .executeTakeFirstOrThrow();
    assert.equal(emptyAudit.status, "succeeded");
    assert.deepEqual((emptyAudit.output as { matches: unknown[] }).matches, []);
    globalThis.fetch = async () =>
      new Response("private provider failure", { status: 503 });
    useToolCalls([
      {
        toolName: "searchSupportingDocuments",
        input: { query: "venue access" },
      },
    ]);
    const failed = await send(await conversation(), "Search again");
    const failureOutput = JSON.stringify(
      publicLookupOutput("searchSupportingDocuments"),
    );
    assert.match(failureOutput, /failed|unavailable|could not/i);
    assert.doesNotMatch(failureOutput, /private provider failure/);
    const failedAudit = await db
      .selectFrom("ai_tool_calls")
      .selectAll()
      .where("customer_message_id", "=", failed.message.id)
      .executeTakeFirstOrThrow();
    assert.equal(failedAudit.status, "failed");
    assert.equal(
      failedAudit.error_code,
      "supporting_document_search_unavailable",
    );
    assert.equal(failedAudit.assistant_message_id, failed.assistantMessage?.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a completed booking draft uses the standard review after a supporting document lookup", async () => {
  const originalFetch = globalThis.fetch;
  const vector = JSON.stringify([1, ...Array<number>(767).fill(0)]);
  const document = await db
    .insertInto("supporting_documents")
    .values({
      original_filename: "Access handbook.pdf",
      storage_key: `${randomUUID()}.pdf`,
      mime_type: "application/pdf",
      byte_size: 500,
      file_sha256: "a".repeat(64),
      pipeline_version: "fixture",
      extraction_status: "complete",
      page_count: 1,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("supporting_document_chunks")
    .values({
      document_id: document.id,
      ordinal: 1,
      page_start: 1,
      page_end: 1,
      heading_path: ["Access"],
      content_text: "Use the east entrance.",
      content_hash: "b".repeat(64),
      embedding: sql<string>`${vector}`,
      embedding_model: "google/gemini-embedding-2",
      embedded_at: new Date(),
    })
    .execute();
  globalThis.fetch = async () =>
    Response.json({ embeddings: [JSON.parse(vector)], warnings: [] });
  try {
    useToolCalls(
      [
        { toolName: "searchSupportingDocuments", input: { query: "entrance" } },
        {
          toolName: "updateBookingDraft",
          input: {
            eventType: "Birthday",
            durationMode: "one_day",
            requestedDates: ["2099-12-12"],
            timeZone: "Asia/Manila",
            contactName: "Test Customer",
            phoneNumber: "09123456789",
            guestCount: 50,
          },
        },
      ],
      undefined,
      undefined,
      "The handbook says to use the east entrance.",
    );
    const result = await send(
      await conversation(),
      "What entrance should I use? Also review my birthday request.",
    );
    assert.ok(result.assistantMessage);
    assert.doesNotMatch(
      result.assistantMessage.body,
      /The handbook says to use the east entrance\./,
    );
    assert.match(result.assistantMessage.body, /Birthday/);
    assert.match(
      result.assistantMessage.body,
      /Should I send this request to AMAC for review\?/,
    );
    const calls = await db
      .selectFrom("ai_tool_calls")
      .selectAll()
      .where("customer_message_id", "=", result.message.id)
      .execute();
    assert.deepEqual(calls.map((call) => call.tool_name).sort(), [
      "reviewBookingDraft",
      "searchSupportingDocuments",
      "updateBookingDraft",
    ]);
    assert.ok(
      calls.every(
        (call) =>
          call.status === "succeeded" &&
          call.assistant_message_id === result.assistantMessage?.id,
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
    await db
      .deleteFrom("supporting_documents")
      .where("id", "=", document.id)
      .execute();
  }
});
