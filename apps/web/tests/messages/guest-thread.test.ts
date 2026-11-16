import assert from "node:assert/strict";
import test from "node:test";
import type { GuestThread } from "../../src/lib/data/messages/guest";
import type { ChatMessage } from "../../src/lib/data/messages/conversations";
import {
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
