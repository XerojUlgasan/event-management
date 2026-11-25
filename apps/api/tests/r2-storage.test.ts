import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { config } from "../src/env.js";
import {
  CatalogMediaNotFound,
  deleteCatalogMedia,
  getCatalogMedia,
  putCatalogMedia,
} from "../src/utils/catalog-media-storage.js";

function configure(t: TestContext, overrides: Partial<typeof config> = {}) {
  const original = { ...config };
  Object.assign(config, {
    S3_API_URL: "https://test.r2.cloudflarestorage.com",
    R2_ACCESS_KEY_ID: "test-key-id",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_BUCKET_NAME: "room-media",
    R2_SUPPORTING_DOCUMENTS_BUCKET_NAME: undefined,
    R2_OBJECT_PREFIX: "test-rooms/catalog/fixture",
    SUPABASE_URL: "https://supabase.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    ...overrides,
  });
  t.after(() => Object.assign(config, original));
}

test("R2 object requests keep key paths, write preconditions and read ranges", async (t) => {
  configure(t);
  const key = "pending/example/video clip.mp4";
  const bytes = Buffer.from("video");
  const methods: string[] = [];

  t.mock.method(globalThis, "fetch", async (request: Request) => {
    assert.equal(
      request.url,
      "https://test.r2.cloudflarestorage.com/room-media/test-rooms/catalog/fixture/pending/example/video%20clip.mp4",
    );
    assert.match(
      request.headers.get("Authorization") ?? "",
      /^AWS4-HMAC-SHA256 Credential=test-key-id\//,
    );
    assert.equal(request.redirect, "error");
    methods.push(request.method);

    if (request.method === "PUT") {
      assert.equal(request.headers.get("Content-Type"), "video/mp4");
      assert.equal(
        request.headers.get("If-None-Match"),
        methods.length === 1 ? "*" : null,
      );
      assert.deepEqual(Buffer.from(await request.arrayBuffer()), bytes);
    } else if (request.method === "GET") {
      assert.equal(request.headers.get("Range"), "bytes=0-1");
      return new Response("vi", { status: 206 });
    }

    return new Response(null, { status: 204 });
  });

  await putCatalogMedia(key, bytes, "video/mp4");
  await putCatalogMedia(key, bytes, "video/mp4", { upsert: true });
  const body = await getCatalogMedia(key, "bytes=0-1");
  assert.equal(await new Response(body).text(), "vi");
  await deleteCatalogMedia(key);
  assert.deepEqual(methods, ["PUT", "PUT", "GET", "DELETE"]);
});

test("supporting documents switch buckets only when configured", async (t) => {
  configure(t);
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (request: string | Request) => {
    urls.push(typeof request === "string" ? request : request.url);
    return new Response("pdf");
  });

  const bucket = "supporting-documents";
  const key = "document.pdf";
  await (await getCatalogMedia(key, undefined, undefined, bucket)).cancel();
  config.R2_SUPPORTING_DOCUMENTS_BUCKET_NAME = "room-documents";
  await (await getCatalogMedia(key, undefined, undefined, bucket)).cancel();

  assert.deepEqual(urls, [
    "https://supabase.invalid/storage/v1/object/supporting-documents/document.pdf",
    "https://test.r2.cloudflarestorage.com/room-documents/test-rooms/catalog/fixture/document.pdf",
  ]);
});

test("R2 missing keys stay distinguishable from bucket failures", async (t) => {
  configure(t);
  const responses = ["NoSuchKey", "NoSuchBucket"];
  t.mock.method(globalThis, "fetch", async () => {
    return new Response(`<Error><Code>${responses.shift()}</Code></Error>`, {
      status: 404,
    });
  });

  await assert.rejects(getCatalogMedia("missing.png"), CatalogMediaNotFound);
  await assert.rejects(getCatalogMedia("missing.png"), /bucket not found/);
});

test("invalid R2 settings fail before any storage request", async (t) => {
  configure(t, {
    S3_API_URL: "https://test.r2.cloudflarestorage.com/room-media",
  });
  const fetch = t.mock.method(globalThis, "fetch");
  await assert.rejects(
    getCatalogMedia("image.png"),
    /endpoint without a bucket path/,
  );
  config.R2_SECRET_ACCESS_KEY = undefined;
  await assert.rejects(
    getCatalogMedia("image.png"),
    /missing endpoint, credentials, or bucket/,
  );
  assert.equal(fetch.mock.callCount(), 0);
});
