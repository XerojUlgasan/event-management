import assert from "node:assert/strict";
import { after, test } from "node:test";
import { embedCatalogContent } from "../../src/services/ai/retrieval/embed-catalog-content.js";
import { setTestConfig } from "../helpers/set-test-config.js";

const originalFetch = globalThis.fetch;
const originalKey = process.env.AI_GATEWAY_API_KEY;
const originalModel = process.env.EMBEDDING_MODEL;
const model = "google/gemini-embedding-2";

setTestConfig({ AI_GATEWAY_API_KEY: "fixture-key" });
setTestConfig({ EMBEDDING_MODEL: model });

after(() => {
  globalThis.fetch = originalFetch;

  if (originalKey === undefined) setTestConfig({ AI_GATEWAY_API_KEY: undefined });
  else setTestConfig({ AI_GATEWAY_API_KEY: originalKey });

  if (originalModel === undefined) setTestConfig({ EMBEDDING_MODEL: undefined });
  else setTestConfig({ EMBEDDING_MODEL: originalModel });
});

function gatewayResponse(vector: number[]) {
  return new Response(JSON.stringify({ embeddings: [vector], warnings: [] }), {
    headers: { "Content-Type": "application/json" },
  });
}

test("sends a photo and its context in one 768-dimensional request", async () => {
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.deepEqual(JSON.parse(String(init?.body)), {
      values: ["title: none | text: A garden venue"],
      dimensions: 768,
      providerOptions: {
        google: {
          content: [[{ inlineData: { mimeType: "image/png", data: "AQID" } }]],
        },
      },
    });
    assert.ok(init?.signal);

    return gatewayResponse([3, 4, ...Array(766).fill(0)]);
  };
  const result = await embedCatalogContent({
    contentMarkdown: "A garden venue",
    image: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" },
  });
  assert.equal(calls, 1);
  assert.equal(result.model, model);
  assert.equal(result.embedding.length, 768);
  assert.equal(result.embedding[0], 0.6);
  assert.equal(result.embedding[1], 0.8);
});

test("text uses the same document format without image content", async () => {
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.values, ["title: none | text: A package"]);
    assert.equal(body.dimensions, 768);
    assert.equal(body.providerOptions, undefined);

    return gatewayResponse([1, ...Array(767).fill(0)]);
  };
  assert.equal(
    (await embedCatalogContent({ contentMarkdown: "A package" })).embedding[0],
    1,
  );
});

test("rejects invalid vectors, unsupported models and image formats", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;

    return gatewayResponse(Array(768).fill(0));
  };
  await assert.rejects(
    embedCatalogContent({ contentMarkdown: "text" }),
    /Invalid embedding vector/,
  );
  globalThis.fetch = async () => gatewayResponse([1]);
  await assert.rejects(
    embedCatalogContent({ contentMarkdown: "text" }),
    /Invalid embedding vector/,
  );
  setTestConfig({ EMBEDDING_MODEL: "google/gemini-embedding-001" });
  await assert.rejects(
    embedCatalogContent({ contentMarkdown: "text" }),
    /Unsupported embedding model/,
  );
  setTestConfig({ EMBEDDING_MODEL: model });
  await assert.rejects(
    embedCatalogContent({
      contentMarkdown: "text",
      image: { bytes: new Uint8Array([1]), mimeType: "image/webp" },
    }),
    /Unsupported embedding image/,
  );
  assert.equal(calls, 1);
});

test("forwards cancellation and does not retry a failed call", async () => {
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;

    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(init.signal?.reason),
        { once: true },
      );
    });
  };
  const controller = new AbortController();
  const pending = embedCatalogContent({
    contentMarkdown: "text",
    abortSignal: controller.signal,
  });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending);
  assert.equal(calls, 1);
});

test("does not retry a provider failure", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;

    return new Response(
      JSON.stringify({ error: { message: "fixture failure" } }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  await assert.rejects(embedCatalogContent({ contentMarkdown: "text" }));
  assert.equal(calls, 1);
});
