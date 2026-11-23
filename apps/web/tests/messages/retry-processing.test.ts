import assert from "node:assert/strict";
import test from "node:test";
import {
  retryAdminMessageProcessing,
  retryMyMessageProcessing,
} from "../../src/lib/data/messages/conversations";
import { retryGuestMessageProcessing } from "../../src/lib/data/messages/guest";
import { ApiError } from "../../src/lib/http/request";
import { conversationLoadError } from "../../src/lib/services/messages/load-error";

test("conversation refresh reports service outages and preserves actionable errors", () => {
  const fallback = "Unable to refresh conversations.";
  assert.equal(
    conversationLoadError(new ApiError("Unavailable", 503), fallback),
    fallback,
  );
  assert.equal(
    conversationLoadError(new TypeError("Failed to fetch"), fallback),
    fallback,
  );
  assert.equal(
    conversationLoadError(new ApiError("Sign in again", 401), fallback),
    "Sign in again",
  );
  assert.equal(
    conversationLoadError(new ApiError("body: Required", 400), fallback),
    "body: Required",
  );
});

test("processing retries target the scoped saved message without resending files", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; method: string | undefined; body: unknown }[] =
    [];
  globalThis.fetch = async (url, options) => {
    calls.push({
      url: String(url),
      method: options?.method,
      body: options?.body,
    });

    return new Response(JSON.stringify({ message: { id: "saved" } }), {
      status: 200,
    });
  };

  try {
    for (const retry of [
      retryMyMessageProcessing,
      retryAdminMessageProcessing,
      retryGuestMessageProcessing,
    ]) {
      assert.equal(
        (await retry("conversation/id", "message/id")).message.id,
        "saved",
      );
    }

    assert.deepEqual(
      calls.map(({ url }) => new URL(url, "http://test").pathname),
      [
        "/v1/messages/conversations/conversation%2Fid/messages/message%2Fid/retry",
        "/v1/admin/conversations/conversation%2Fid/messages/message%2Fid/retry",
        "/v1/guest/conversations/conversation%2Fid/messages/message%2Fid/retry",
      ],
    );
    assert.ok(
      calls.every(({ method, body }) => method === "POST" && body === "{}"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
