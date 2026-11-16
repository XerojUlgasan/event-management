import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicEnv } from "../../src/lib/env/env.ts";
import { createServerEnv } from "../../src/lib/server/config/env.ts";

test("public settings retain API defaults, relative URLs and optional Firebase", () => {
  assert.equal(createPublicEnv({}).PUBLIC_API_URL, "http://localhost:3000/v1");
  assert.equal(
    createPublicEnv({ PUBLIC_API_URL: "/v1" }).PUBLIC_API_URL,
    "/v1",
  );
  assert.equal(createPublicEnv({ PUBLIC_API_URL: "" }).PUBLIC_API_URL, "");
  assert.equal(createPublicEnv({}).firebaseConfigured, false);
  const env = createPublicEnv({
    PUBLIC_FIREBASE_API_KEY: "test-key",
    PUBLIC_FIREBASE_AUTH_DOMAIN: "example.test",
    PUBLIC_FIREBASE_PROJECT_ID: "test-project",
  });
  assert.equal(env.firebaseConfigured, true);
  assert.equal(env.firebaseConfig.projectId, "test-project");
  assert.equal(env.firebaseConfig.appId, undefined);
});

test("server API URLs preserve proxy precedence, slash handling and relative fallback", () => {
  assert.equal(createServerEnv({}).SERVER_API_URL, "http://127.0.0.1:3000/v1");
  assert.equal(
    createServerEnv({ PUBLIC_API_URL: "/v1" }).SERVER_API_URL,
    "http://127.0.0.1:3000/v1",
  );
  assert.equal(
    createServerEnv({ PUBLIC_API_URL: "https://api.example.test/v1/" })
      .SERVER_API_URL,
    "https://api.example.test/v1",
  );
  const source = {
    API_PROXY_TARGET: "http://127.0.0.1:54321/",
    PUBLIC_API_URL: "/v1",
  };
  const env = createServerEnv(source);
  assert.equal(env.API_PROXY_TARGET, source.API_PROXY_TARGET);
  assert.equal(
    env.SERVER_API_URL,
    "http://127.0.0.1:54321/functions/v1/api/v1",
  );
  source.API_PROXY_TARGET = "";
  source.PUBLIC_API_URL = "https://api.example.test/v1";
  assert.equal(env.SERVER_API_URL, source.PUBLIC_API_URL);
});
