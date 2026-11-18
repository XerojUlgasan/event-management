import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChatMessage,
  ChatThread,
} from "../../src/lib/data/messages/conversations";
import {
  addSentMessages,
  addSentMessagesToConversation,
  mergePolledThread,
  prependOlder,
} from "../../src/lib/services/messages/merge-thread";

const message = (id: number): ChatMessage => ({
  id: String(id),
  quotationId: null,
  body: String(id),
  senderId: "sender",
  senderRole: "customer",
  senderName: "Sender",
  createdAt: "2090-01-01T00:00:00.000Z",
  readAt: null,
});
const thread = (ids: number[], nextCursor: string | null): ChatThread => ({
  conversation: { id: "thread" } as ChatThread["conversation"],
  messages: ids.map(message),
  nextCursor,
});
const range = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);
const ids = (value: ChatThread) =>
  value.messages.map((item) => Number(item.id));

const datedMessage = (id: number, second: number): ChatMessage => ({
  ...message(id),
  createdAt: `2090-01-01T00:00:${String(second).padStart(2, "0")}.000Z`,
});
const datedThread = (messages: ChatMessage[]): ChatThread => ({
  ...thread([], "older"),
  conversation: {
    ...thread([], null).conversation,
    lastMessage: messages.at(-1) ?? null,
    updatedAt: messages.at(-1)?.createdAt ?? "2090-01-01T00:00:00.000Z",
  },
  messages,
});

test("send response deduplicates both messages already received by polling", () => {
  const sent = [datedMessage(2, 2), datedMessage(3, 3)];
  const result = addSentMessages(
    datedThread([datedMessage(1, 1), ...sent]),
    sent,
  );
  assert.deepEqual(ids(result), [1, 2, 3]);
  assert.equal(result.nextCursor, "older");
  assert.equal(result.conversation.lastMessage?.id, "3");
});

test("an older polled thread cannot replace a newer confirmed AI setting", () => {
  const current = {
    ...thread([1, 2], null),
    conversation: {
      id: "thread",
      aiEnabled: false,
      aiVersion: 3,
      aiHandoff: {
        reason: "customer_requested",
        summary: "Needs help",
        pending: false,
      },
    } as ChatThread["conversation"],
  };
  const olderPoll = {
    ...thread([2], null),
    conversation: {
      id: "thread",
      aiEnabled: true,
      aiVersion: 2,
      aiHandoff: {
        reason: "customer_requested",
        summary: "Needs help",
        pending: true,
      },
    } as ChatThread["conversation"],
  };

  const result = mergePolledThread(current, olderPoll, new Set());

  assert.equal(result.thread.conversation.aiEnabled, false);
  assert.equal(result.thread.conversation.aiVersion, 3);
  assert.equal(result.thread.conversation.aiHandoff?.pending, false);
});

test("a newer handoff replaces the previous taken-over state", () => {
  const current = {
    ...thread([1], null),
    conversation: {
      id: "thread",
      aiEnabled: false,
      aiVersion: 3,
      aiHandoff: {
        reason: "customer_requested",
        summary: "Earlier",
        pending: false,
      },
    } as ChatThread["conversation"],
  };
  const incoming = {
    ...thread([1, 2], null),
    conversation: {
      id: "thread",
      aiEnabled: false,
      aiVersion: 4,
      aiHandoff: {
        reason: "cannot_answer",
        summary: "New question",
        pending: true,
      },
    } as ChatThread["conversation"],
  };
  const result = mergePolledThread(current, incoming, new Set());
  assert.equal(result.thread.conversation.aiHandoff?.pending, true);
  assert.equal(result.thread.conversation.aiHandoff?.summary, "New question");
});

test("send response places a missing customer message before its polled assistant reply", () => {
  const customer = datedMessage(2, 2);
  const assistant = datedMessage(3, 2);
  const result = addSentMessages(datedThread([datedMessage(1, 1), assistant]), [
    customer,
    assistant,
  ]);
  assert.deepEqual(ids(result), [1, 2, 3]);
});

test("send response appends a missing assistant after the polled customer message", () => {
  const customer = datedMessage(2, 2);
  const assistant = datedMessage(3, 2);
  const result = addSentMessages(datedThread([datedMessage(1, 1), customer]), [
    customer,
    assistant,
  ]);
  assert.deepEqual(ids(result), [1, 2, 3]);
  assert.equal(result.conversation.lastMessage?.id, "3");
});

test("a timestamp tie does not replace an unrelated server-reported latest message", () => {
  const latest = datedMessage(5, 5);
  const result = addSentMessages(datedThread([latest]), [datedMessage(2, 5)]);
  assert.equal(result.conversation.lastMessage?.id, "5");
});

test("a late failed AI response inserts the older customer message before newer polled messages", () => {
  const newer = [datedMessage(4, 4), datedMessage(5, 5)];
  const result = addSentMessages(datedThread(newer), [datedMessage(2, 2)]);
  assert.deepEqual(ids(result), [2, 4, 5]);
  assert.equal(result.conversation.lastMessage?.id, "5");
  assert.equal(result.conversation.updatedAt, newer[1].createdAt);
  assert.equal(result.nextCursor, "older");
});

test("a send completing after a conversation switch does not alter the visible thread", () => {
  const current = datedThread([datedMessage(8, 8)]);
  assert.equal(
    addSentMessagesToConversation(current, "other", [datedMessage(2, 2)]),
    current,
  );
});

test("a local send alone cannot bridge a gap in a burst of server messages", () => {
  const current = thread([...range(1, 15), 35], null);
  const incoming = thread(range(21, 35), "before-21");
  const result = mergePolledThread(current, incoming, new Set(["35"]));
  assert.equal(result.gap, true);
  assert.deepEqual(ids(result.thread), range(21, 35));
  assert.equal(result.thread.nextCursor, "before-21");
  const older = thread(range(6, 20), "before-6");
  const loaded = prependOlder(result.thread, older);
  assert.deepEqual(ids(loaded), range(6, 35));
  assert.equal(loaded.nextCursor, "before-6");
});

test("a gap reset preserves a confirmed send absent from the poll", () => {
  const result = mergePolledThread(
    thread([...range(1, 15), 36], null),
    thread(range(21, 35), "before-21"),
    new Set(["36"]),
  );
  assert.equal(result.gap, true);
  assert.deepEqual(ids(result.thread), range(21, 36));
  assert.equal(result.thread.nextCursor, "before-21");
});

test("server-fetched overlap retains loaded history and deduplicates the latest page", () => {
  const result = mergePolledThread(
    thread([...range(1, 15), 17], "before-1"),
    thread(range(12, 17), "before-12"),
    new Set(["17"]),
  );
  assert.equal(result.gap, false);
  assert.deepEqual(ids(result.thread), range(1, 17));
  assert.equal(result.thread.nextCursor, "before-1");
});

test("an acknowledged local message becomes a valid server overlap on later polls", () => {
  const result = mergePolledThread(
    thread(range(21, 35), "before-21"),
    thread(range(35, 40), "before-35"),
    new Set(),
  );
  assert.equal(result.gap, false);
  assert.deepEqual(ids(result.thread), range(21, 40));
  assert.equal(result.thread.nextCursor, "before-21");
});
