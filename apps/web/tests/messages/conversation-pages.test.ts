import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChatConversation,
  ChatMessage,
} from "../../src/lib/data/messages/conversations";
import {
  appendConversations,
  readRecentConversations,
  refreshConversations,
} from "../../src/lib/services/messages/conversation-pages";

const message = (id: string, body: string): ChatMessage => ({
  id,
  quotationId: null,
  body,
  senderId: "customer-1",
  senderRole: "customer",
  senderName: "Customer",
  createdAt: "2026-11-14T09:00:00.000Z",
  readAt: null,
});

const conversation = (
  id: string,
  body: string | null = null,
): ChatConversation => ({
  id,
  customerId: "customer-1",
  customerName: "Customer",
  customerEmail: "customer@example.invalid",
  packageId: null,
  packageName: null,
  bookingRequestId: null,
  bookingRequestReference: null,
  eventType: null,
  eventStartsAt: null,
  eventEndsAt: null,
  guestCount: null,
  status: "active",
  closedAt: null,
  aiEnabled: true,
  aiVersion: 0,
  lastMessage: body === null ? null : message(`message-${id}`, body),
  unreadCount: 0,
  updatedAt: "2026-11-14T09:00:00.000Z",
});

test("append deduplicates overlaps while preserving server order and the recent row", () => {
  const recent = [conversation("a"), conversation("b", "recent preview")];
  const older = [
    conversation("b", "stale preview"),
    conversation("c"),
    conversation("c"),
  ];

  const result = appendConversations(recent, older);

  assert.deepEqual(
    result.map((item) => item.id),
    ["a", "b", "c"],
  );
  assert.equal(result[1], recent[1]);
  assert.equal(result[1]?.lastMessage?.body, "recent preview");
});

test("refresh moves recent rows to the head and preserves the loaded tail", () => {
  const loaded = [conversation("b", "old b"), conversation("c", "tail")];
  const recent = [conversation("a"), conversation("b", "updated b")];

  const result = refreshConversations(loaded, recent);

  assert.deepEqual(
    result.map((item) => item.id),
    ["a", "b", "c"],
  );
  assert.equal(result[1]?.lastMessage?.body, "updated b");
  assert.equal(result[2], loaded[1]);
});

test("a stale inbox page cannot restore handoff pending after a reply", () => {
  const old = {
    ...conversation("a"),
    aiVersion: 2,
    aiHandoff: {
      reason: "customer_requested" as const,
      summary: "Help",
      pending: true,
    },
  };
  const confirmed = {
    ...old,
    aiVersion: 3,
    aiEnabled: false,
    aiHandoff: { ...old.aiHandoff, pending: false },
  };
  const result = refreshConversations([confirmed], [old]);
  assert.equal(result[0]?.aiVersion, 3);
  assert.equal(result[0]?.aiHandoff?.pending, false);
});

test("recent read bridges new rows across pages until it reaches a known row", async () => {
  const known = conversation("known", "latest known row");
  const calls: (string | undefined)[] = [];
  const pages = [
    {
      conversations: [conversation("new-1"), conversation("new-2")],
      nextCursor: "page-2",
    },
    { conversations: [conversation("new-3"), known], nextCursor: "page-3" },
  ];

  const result = await readRecentConversations(
    async (cursor) => {
      calls.push(cursor);
      const next = pages.shift();

      if (!next) throw new Error("unexpected page request");

      return next;
    },
    new Map([[known.id, known]]),
  );

  assert.deepEqual(calls, [undefined, "page-2"]);
  assert.deepEqual(
    result.conversations.map((item) => item.id),
    ["new-1", "new-2", "new-3", "known"],
  );
  assert.equal(result.conversations[3]?.lastMessage?.body, "latest known row");
  assert.equal(result.nextCursor, "page-3");
});

test("initial recent read stays bounded to one page", async () => {
  const calls: (string | undefined)[] = [];

  const result = await readRecentConversations(async (cursor) => {
    calls.push(cursor);

    return {
      conversations: [conversation("first-page")],
      nextCursor: "next-page",
    };
  }, new Map());

  assert.deepEqual(calls, [undefined]);
  assert.deepEqual(
    result.conversations.map((item) => item.id),
    ["first-page"],
  );
  assert.equal(result.nextCursor, "next-page");
});

test("recent read returns all rows when pagination is exhausted before a known overlap", async () => {
  const calls: (string | undefined)[] = [];
  const pages = [
    { conversations: [conversation("new-1")], nextCursor: "page-2" },
    { conversations: [conversation("new-2")], nextCursor: null },
  ];

  const result = await readRecentConversations(
    async (cursor) => {
      calls.push(cursor);
      const next = pages.shift();

      if (!next) throw new Error("unexpected page request");

      return next;
    },
    new Map([["already-loaded", conversation("already-loaded")]]),
  );

  assert.deepEqual(calls, [undefined, "page-2"]);
  assert.deepEqual(
    result.conversations.map((item) => item.id),
    ["new-1", "new-2"],
  );
  assert.equal(result.nextCursor, null);
});

test("recent read rejects a repeated cursor when no known row bridges the pages", async () => {
  const calls: (string | undefined)[] = [];
  await assert.rejects(
    readRecentConversations(
      async (cursor) => {
        calls.push(cursor);

        return {
          conversations: [conversation(`row-${calls.length}`)],
          nextCursor: "same-cursor",
        };
      },
      new Map([["already-loaded", conversation("already-loaded")]]),
    ),
    /Unable to refresh conversations/,
  );

  assert.deepEqual(calls, [undefined, "same-cursor"]);
});

test("recent read propagates loader errors", async () => {
  const error = new Error("inbox page unavailable");

  await assert.rejects(
    readRecentConversations(
      async () => {
        throw error;
      },
      new Map([["already-loaded", conversation("already-loaded")]]),
    ),
    error,
  );
});

test("an updated known row cannot bridge a burst of unseen conversations", async () => {
  const original = conversation("known", "old activity");
  const updated = {
    ...original,
    lastMessage: message("new-message", "new activity"),
  };
  const unchanged = conversation("anchor");
  const pages = [
    { conversations: [updated, conversation("new-1")], nextCursor: "next" },
    { conversations: [conversation("new-2"), unchanged], nextCursor: "older" },
  ];

  const result = await readRecentConversations(
    async () => {
      const page = pages.shift();

      if (!page) throw new Error("unexpected request");

      return page;
    },
    new Map([
      [original.id, original],
      [unchanged.id, unchanged],
    ]),
  );

  assert.deepEqual(
    result.conversations.map((item) => item.id),
    ["known", "new-1", "new-2", "anchor"],
  );
  assert.equal(pages.length, 0);
});
