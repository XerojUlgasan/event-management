import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { jsonError, serviceError } from "../src/utils/service-result.js";

test("service errors keep the message and status together", () => {
  assert.deepEqual(serviceError("Taken", 409), {
    message: "Taken",
    status: 409,
  });
});

test("jsonError writes the shared error envelope", async () => {
  const app = new Hono();
  app.get("/missing", (c) => jsonError(c, "Package not found", 404));
  const response = await app.request("/missing");
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Package not found" });
});
