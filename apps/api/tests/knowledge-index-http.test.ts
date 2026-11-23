import assert from "node:assert/strict";
import test from "node:test";
import { app as nodeApp } from "../src/app.js";
import { app as edgeApp } from "../src/edge/server.js";
import { SMALL_JSON_BODY_LIMIT_BYTES } from "../src/constants/http.js";

// These requests never carry a session and must not query the application DB.
// Authenticated submission and worker execution use disposable DB fixtures in
// ai/catalog-embeddings.test.ts. This checks each real HTTP dispatch/body guard.
for (const [runtime, app] of [
  ["Node", nodeApp],
  ["Edge dispatch", edgeApp],
] as const) {
  test(`${runtime} knowledge submission keeps auth, body cap, and accepted contract`, async () => {
    const missingSession = await app.request("/v1/admin/ai/knowledge/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(missingSession.status, 401);
    assert.deepEqual(await missingSession.json(), { error: "Not signed in" });

    const oversized = await app.request("/v1/admin/ai/knowledge/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        padding: "x".repeat(SMALL_JSON_BODY_LIMIT_BYTES),
      }),
    });
    assert.equal(oversized.status, 413);

    const documentation = await app.request("/openapi.json");
    assert.equal(documentation.status, 200);
    const document = await documentation.json();
    const operation = document.paths["/v1/admin/ai/knowledge/index"].post;
    assert.ok(operation.responses[202]);
    assert.equal(operation.responses[200], undefined);
    const requestSchema =
      operation.requestBody.content["application/json"].schema;
    assert.deepEqual(requestSchema.properties, {});
    assert.equal(requestSchema.additionalProperties, false);
    const responseSchema =
      operation.responses[202].content["application/json"].schema;
    assert.deepEqual(Object.keys(responseSchema.properties).sort(), [
      "failedListings",
      "pendingListings",
      "skippedListings",
      "submittedListings",
    ]);
  });
}
