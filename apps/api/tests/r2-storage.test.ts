import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { config } from "../src/env.js";
import {
  deleteSupportingDocument,
  putSupportingDocument,
  readSupportingDocument,
} from "../src/services/supporting-documents/document-storage.js";
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
    R2_OBJECT_PREFIX: "test-rooms/catalog/fixture",
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

test("supporting documents use the same R2 bucket as media", async (t) => {
  configure(t);
  const key = "document.pdf";
  const bytes = Buffer.from("%PDF-fixture");
  const methods: string[] = [];
  t.mock.method(globalThis, "fetch", async (request: Request) => {
    assert.equal(
      request.url,
      "https://test.r2.cloudflarestorage.com/room-media/test-rooms/catalog/fixture/document.pdf",
    );
    methods.push(request.method);

    if (request.method === "PUT") {
      assert.equal(request.headers.get("Content-Type"), "application/pdf");
      assert.deepEqual(Buffer.from(await request.arrayBuffer()), bytes);
    } else if (request.method === "GET") {
      return new Response(bytes);
    }

    return new Response(null, { status: 204 });
  });

  await putSupportingDocument(key, bytes);
  assert.deepEqual(
    Buffer.from(await readSupportingDocument(key, AbortSignal.timeout(1000))),
    bytes,
  );
  await deleteSupportingDocument(key);
  assert.deepEqual(methods, ["PUT", "GET", "DELETE"]);
});

test("file operations do not fall back when R2 is unconfigured", async (t) => {
  configure(t, {
    S3_API_URL: undefined,
    R2_ACCESS_KEY_ID: undefined,
    R2_SECRET_ACCESS_KEY: undefined,
    R2_BUCKET_NAME: undefined,
    R2_OBJECT_PREFIX: undefined,
  });
  const fetch = t.mock.method(globalThis, "fetch");

  await assert.rejects(getCatalogMedia("image.png"), /R2 storage requires/);
  await assert.rejects(
    putCatalogMedia("image.png", Buffer.from("image"), "image/png"),
    /R2 storage requires/,
  );
  await assert.rejects(deleteCatalogMedia("image.png"), /R2 storage requires/);
  assert.equal(fetch.mock.callCount(), 0);
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
  await assert.rejects(getCatalogMedia("image.png"), /R2 storage requires/);
  assert.equal(fetch.mock.callCount(), 0);
});
