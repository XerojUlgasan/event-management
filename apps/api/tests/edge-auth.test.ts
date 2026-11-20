import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

// Run against `pnpm dev` or `pnpm dev:edge` after building the current bundle.
const api =
  process.env.EDGE_API_URL ?? "http://127.0.0.1:54321/functions/v1/api";

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
  assert.deepEqual(await response.json(), {
    error: "Incorrect email or password.",
  });
});

test("Edge OpenAPI loads every router including auth", async () => {
  const response = await fetch(`${api}/openapi.json`);
  assert.equal(response.status, 200, await response.clone().text());
  const document = await response.json();
  assert.ok(document.paths["/v1/auth/login"]);
  assert.ok(document.paths["/v1/admin/booking-requests/{id}/quotations"]);
  assert.ok(document.paths["/v1/booking-requests/{id}/quotations"]);
  assert.ok(document.paths["/v1/admin/quotations/{id}/send"]);
  assert.equal(document.paths["/v1/quotations/{id}/accept"], undefined);
  assert.equal(document.paths["/v1/quotations/{id}/revision"], undefined);
  assert.ok(document.paths["/v1/admin/quotations/{id}/revision"]);
  const quotation =
    document.paths["/v1/quotations/{id}"].get.responses[200].content[
      "application/json"
    ].schema.properties.quotation;
  assert.deepEqual(quotation.properties.status.enum, [
    "draft",
    "sent",
    "superseded",
  ]);
  assert.equal("acceptedAt" in quotation.properties, false);
  assert.equal(quotation.required.includes("acceptedAt"), false);
});

test("Edge loads nested and top-level quotation/private package routes with authentication", async () => {
  const id = randomUUID();

  for (const path of [
    `/admin/booking-requests/${id}/quotations`,
    `/booking-requests/${id}/quotations`,
    `/admin/booking-requests/${id}/package`,
    `/quotations/${id}`,
  ]) {
    const response = await fetch(`${api}/v1${path}`);
    assert.equal(
      response.status,
      401,
      `${path}: ${await response.clone().text()}`,
    );
  }
});
