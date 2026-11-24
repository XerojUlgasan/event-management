import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { config } from "../../src/env.ts";

async function buildClientConfig(
  context: TestContext,
  settings: NodeJS.ProcessEnv,
): Promise<typeof config> {
  const source = { ...process.env };

  for (const [name, value] of Object.entries(settings)) {
    if (value === undefined) delete source[name];
    else source[name] = value;
  }

  context.mock.property(process, "env", source);

  const result = await build({
    configFile: false,
    envFile: false,
    envPrefix: "PUBLIC_",
    logLevel: "silent",
    build: {
      lib: {
        entry: fileURLToPath(new URL("../../src/env.ts", import.meta.url)),
        formats: ["es"],
      },
      write: false,
    },
  });
  assert.ok(!Array.isArray(result) || result.length === 1);
  const bundle = Array.isArray(result) ? result[0] : result;
  assert.ok("output" in bundle);
  const chunk = bundle.output[0];
  assert.equal(chunk.type, "chunk");
  assert.ok(!chunk.code.includes("server-only-fixture"));
  assert.ok(!chunk.code.includes("process.env"));

  const code = Buffer.from(chunk.code).toString("base64");

  return (await import(`data:text/javascript;base64,${code}`)).config;
}

test("browser config uses Vite public values and guards server settings", async (context) => {
  const browser = await buildClientConfig(context, {
    PUBLIC_API_URL: "/v1/",
    PUBLIC_FIREBASE_API_KEY: "test-key",
    PUBLIC_FIREBASE_AUTH_DOMAIN: "example.test",
    PUBLIC_FIREBASE_PROJECT_ID: "test-project",
    PUBLIC_FIREBASE_APP_ID: undefined,
    API_PROXY_TARGET: "https://server-only-fixture.invalid",
  });
  assert.equal(browser.PUBLIC_API_URL, "/v1");
  assert.equal(browser.firebaseConfigured, true);
  assert.equal(browser.firebaseConfig.projectId, "test-project");
  assert.equal(browser.firebaseConfig.appId, undefined);
  assert.throws(() => browser.API_PROXY_TARGET, /unavailable in the browser/);
  assert.throws(() => browser.SERVER_API_URL, /unavailable in the browser/);
});

test("browser config preserves an explicitly empty public API URL", async (context) => {
  const browser = await buildClientConfig(context, { PUBLIC_API_URL: "" });
  assert.equal(browser.PUBLIC_API_URL, "");
});

test("source imports default browser settings before Vite initializes", () => {
  assert.equal(config.PUBLIC_API_URL, "http://localhost:3000/v1");
  assert.equal(config.firebaseConfigured, false);
});

test("server config reads runtime values and preserves proxy precedence", (context) => {
  const source: NodeJS.ProcessEnv = {};
  context.mock.property(process, "env", source);

  assert.equal(config.SERVER_API_URL, "http://127.0.0.1:3000/v1");
  source.PUBLIC_API_URL = "/v1";
  assert.equal(config.SERVER_API_URL, "http://127.0.0.1:3000/v1");
  source.PUBLIC_API_URL = "https://api.example.test/v1/";
  assert.equal(config.SERVER_API_URL, "https://api.example.test/v1");

  source.API_PROXY_TARGET = "http://127.0.0.1:54321/";
  assert.equal(config.API_PROXY_TARGET, source.API_PROXY_TARGET);
  assert.equal(
    config.SERVER_API_URL,
    "http://127.0.0.1:54321/functions/v1/api/v1",
  );
  source.API_PROXY_TARGET = "";
  assert.equal(config.SERVER_API_URL, "https://api.example.test/v1");
});
