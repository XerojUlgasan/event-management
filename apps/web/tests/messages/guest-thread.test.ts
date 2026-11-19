import assert from "node:assert/strict";
import test from "node:test";
import type { GuestThread } from "../../src/lib/data/messages/guest";
import type { ChatMessage } from "../../src/lib/data/messages/conversations";
import {
  addGuestSentMessages,
  guestRemaining,
  guestReservedSends,
  mergeGuestAllowance,
  mergeGuestMessages,
  mergeGuestThread,
  prepareGuestSend,
} from "../../src/lib/services/messages/guest-thread";
const message = (id: string) => ({ id }) as ChatMessage;
const thread = (ids: string[], cursor: string | null, id = "guest") =>
  ({
    conversation: { id },
    messages: ids.map(message),
    nextCursor: cursor,
    guest: { remainingMessages: 1 },
  }) as GuestThread;
test("send and polling responses do not duplicate the same messages", () => {
  assert.deepEqual(
    mergeGuestMessages(
      [message("a"), message("b")],
      [message("b"), message("c")],
    ).map((m) => m.id),
    ["a", "b", "c"],
  );
});
test("older pages preserve loaded history and advance the cursor", () => {
  const result = mergeGuestThread(
    thread(["b", "c"], "before-b"),
    thread(["a", "b"], null),
    true,
  );
  assert.deepEqual(
    result.messages.map((m) => m.id),
    ["a", "b", "c"],
  );
  assert.equal(result.nextCursor, null);
});
test("a disjoint recent page resets to its server cursor rather than hiding a gap", () => {
  const result = mergeGuestThread(
    thread(["a", "b"], null),
    thread(["d", "e"], "before-d"),
  );
  assert.deepEqual(
    result.messages.map((m) => m.id),
    ["d", "e"],
  );
  assert.equal(result.nextCursor, "before-d");
});
test("a different guest conversation never inherits earlier history", () => {
  assert.deepEqual(
    mergeGuestThread(
      thread(["old"], null),
      thread(["new"], null, "other"),
    ).messages.map((m) => m.id),
    ["new"],
  );
});

test("an uncertain send retries the original request even if the draft changes", () => {
  const first = prepareGuestSend(null, " hello ", () => "request-one");
  assert.deepEqual(first, { body: "hello", requestId: "request-one" });
  assert.deepEqual(
    prepareGuestSend(first, "changed", () => "request-two"),
    first,
  );
  assert.deepEqual(
    prepareGuestSend(null, "changed", () => "request-two"),
    { body: "changed", requestId: "request-two" },
  );
  assert.equal(
    prepareGuestSend(null, "   ", () => "unused"),
    null,
  );
});

test("confirmed image rejections release guest slots while uncertain sends remain reserved", () => {
  const rejected = Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [
      String(index),
      { definitelyUnsent: true },
    ]),
  );
  assert.equal(guestRemaining(5, guestReservedSends(rejected)), 5);
  const withUncertain = {
    ...rejected,
    pending: {},
    uncertain: { definitelyUnsent: false },
  };
  assert.equal(guestRemaining(5, guestReservedSends(withUncertain)), 3);
  assert.equal(guestRemaining(0, guestReservedSends(rejected)), 0);
});

test("overlapping guest sends reserve slots and stale responses cannot restore allowance", () => {
  assert.equal(guestRemaining(5, 2), 3);
  const newerResponse = mergeGuestAllowance(5, 3);
  const olderResponse = mergeGuestAllowance(newerResponse, 4);
  assert.equal(olderResponse, 3);
  assert.equal(guestRemaining(olderResponse, 1), 2);
  assert.equal(guestRemaining(0, 1), 0);
});

test("late guest response is inserted by creation time without duplicating a polled reply", () => {
  const timed = (id: string, createdAt: string) =>
    ({ id, createdAt }) as ChatMessage;
  const m1 = timed("m1", "2026-01-01T00:00:01.000Z");
  const m2 = timed("m2", "2026-01-01T00:00:02.000Z");
  const a2 = timed("a2", "2026-01-01T00:00:03.000Z");
  const a1 = timed("a1", "2026-01-01T00:00:04.000Z");
  assert.deepEqual(
    addGuestSentMessages([m2, a2, a1], [m1, a1]).map((item) => item.id),
    ["m1", "m2", "a2", "a1"],
  );
});

test("polling restores server order around a previously returned send", () => {
  const result = mergeGuestThread(
    thread(["m2", "a2"], null),
    thread(["m1", "m2", "a2", "a1"], null),
  );
  assert.deepEqual(
    result.messages.map((item) => item.id),
    ["m1", "m2", "a2", "a1"],
  );
});
