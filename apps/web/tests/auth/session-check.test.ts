import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, request } from "../../src/lib/http/request";

const browser = new EventTarget();

Object.assign(globalThis, { window: browser });

test("401 on a data request requests session confirmation, while credential and /me failures do not", async () => {
  const originalFetch = globalThis.fetch;
  let checks = 0;
  browser.addEventListener("clemora:session-check", () => checks++);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    for (const path of [
      "/auth/login",
      "/auth/sync",
      "/auth/link/firebase",
      "/me",
    ]) {
      await assert.rejects(
        request(path),
        (error: unknown) => error instanceof ApiError && error.status === 401,
      );
      assert.equal(checks, 0);
    }

    await assert.rejects(
      request("/admin/packages"),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(checks, 1);
    globalThis.fetch = async () => new Response("Unavailable", { status: 500 });
    await assert.rejects(request("/admin/packages"));
    assert.equal(checks, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("server failures do not imply a form error and validation details remain visible", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => new Response("Starting", { status: 503 });
    await assert.rejects(
      request("/messages/conversations"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.message === "Unable to complete the request. Please try again.",
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: { issues: [{ path: ["body"], message: "Required" }] },
        }),
        { status: 400 },
      );
    await assert.rejects(
      request("/messages/conversations"),
      (error: unknown) =>
        error instanceof ApiError && error.message === "body: Required",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
