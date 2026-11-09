import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

// Run against `pnpm dev` or `pnpm dev:edge` after building the current bundle.
const api = "http://127.0.0.1:54321/functions/v1/api";

test("the Edge auth router loads and rejects a missing session", async () => {
  const response = await fetch(`${api}/v1/me`);
  assert.equal(response.status, 401, await response.clone().text());
  assert.deepEqual(await response.json(), { error: "Not signed in" });
});

test("Edge password verification rejects an unknown account without a runtime error", async () => {
  const response = await fetch(`${api}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `argon2-edge-${randomUUID()}@example.test`,
      password: "edge-regression-password",
    }),
  });
  assert.equal(response.status, 401, await response.clone().text());
  assert.deepEqual(await response.json(), { error: "Incorrect email or password." });
});

test("Edge OpenAPI loads every router including auth", async () => {
  const response = await fetch(`${api}/openapi.json`);
  assert.equal(response.status, 200, await response.clone().text());
  const document = await response.json();
  assert.ok(document.paths["/v1/auth/login"]);
});
