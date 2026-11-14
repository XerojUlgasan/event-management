import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChatMessage,
  ChatThread,
} from "../../src/lib/data/messages/conversations";
import {
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
