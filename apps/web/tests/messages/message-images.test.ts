import assert from "node:assert/strict";
import test from "node:test";
import { messagePayload } from "../../src/lib/data/messages/conversations";
import { prepareGuestSend } from "../../src/lib/services/messages/guest-thread";
import { messageImageUrl } from "../../src/lib/utils/messages/image-url";

test("image URLs preserve the configured Node, proxy, and Edge API mount", () => {
  const path = "/v1/message-images/image-one";
  assert.equal(messageImageUrl(path, "/v1"), "/v1/message-images/image-one");
  assert.equal(
    messageImageUrl(path, "https://api.example.test/v1/"),
    "https://api.example.test/v1/message-images/image-one",
  );
  assert.equal(
    messageImageUrl(path, "https://api.example.test/functions/v1/api/v1"),
    "https://api.example.test/functions/v1/api/v1/message-images/image-one",
  );
});

test("image messages send files as multipart with their retry identity", () => {
  const first = new File(["first"], "first.png", { type: "image/png" });
  const second = new File(["second"], "second.webp", { type: "image/webp" });
  const pending = prepareGuestSend(null, "  ", () => "request-one", [
    first,
    second,
  ]);
  assert.ok(pending);
  const retry = prepareGuestSend(pending, "changed", () => "request-two", []);
  assert.equal(retry, pending);
  const payload = messagePayload(retry.body, retry.files ?? [], {
    requestId: retry.requestId,
    conversationId: "thread-one",
  });
  assert.ok(payload instanceof FormData);
  assert.equal(payload.get("body"), "");
  assert.equal(payload.get("requestId"), "request-one");
  assert.equal(payload.get("conversationId"), "thread-one");
  assert.deepEqual(payload.getAll("images"), [first, second]);
});

test("text-only sends keep the existing JSON payload", () => {
  assert.deepEqual(messagePayload("hello", [], { requestId: "one" }), {
    body: "hello",
    requestId: "one",
  });
});
