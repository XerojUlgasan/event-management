import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import type { Selectable } from "kysely";
import { Image } from "imagescript";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import type { MediaAssets } from "../../src/db/types.js";
import { readCatalogEmbeddingImage } from "../../src/services/ai/retrieval/read-catalog-embedding-image.js";
import { setTestConfig } from "../helpers/set-test-config.js";

const originalFetch = globalThis.fetch;
const oldUrl = process.env.SUPABASE_URL;
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const oldBucket = process.env.SUPABASE_STORAGE_BUCKET;

setTestConfig({ SUPABASE_URL: "https://storage.invalid" });
setTestConfig({ SUPABASE_SERVICE_ROLE_KEY: "fixture-key" });
setTestConfig({ SUPABASE_STORAGE_BUCKET: "fixture-bucket" });

after(() => {
  globalThis.fetch = originalFetch;

  setTestConfig({
    SUPABASE_URL: oldUrl,
    SUPABASE_SERVICE_ROLE_KEY: oldKey,
    SUPABASE_STORAGE_BUCKET: oldBucket,
  });
});

function asset(
  overrides: Partial<Selectable<MediaAssets>> = {},
): Selectable<MediaAssets> {
  return {
    id: "fixture-id",
    kind: "image",
    source: "upload",
    storage_key: "catalog-media/fixture-id",
    mime_type: "image/png",
    byte_size: null,
    created_at: new Date(),
    created_by: null,
    gallery_position: null,
    showcase_record_id: null,
    url: null,
    ...overrides,
  };
}

function serve(bytes: Uint8Array) {
  globalThis.fetch = async (input) => {
    assert.equal(
      String(input),
      "https://storage.invalid/storage/v1/object/fixture-bucket/catalog-media/fixture-id",
    );

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    );
  };
}

test("reads only checked-in allowlisted sample images", async () => {
  globalThis.fetch = async () => {
    throw new Error("unexpected network access");
  };
  const sample = await readCatalogEmbeddingImage(
    asset({ source: "sample", storage_key: null, url: "/images/wedding.jpg" }),
  );
  assert.equal(sample.mimeType, "image/jpeg");
  assert.deepEqual(
    sample.bytes,
    await readFile(
      new URL("../../../web/public/images/wedding.jpg", import.meta.url),
    ),
  );

  for (const url of [
    "/images/login.jpg",
    "/images/../images/wedding.jpg",
    "https://example.com/p.jpg",
  ]) {
    await assert.rejects(
      readCatalogEmbeddingImage(
        asset({ source: "sample", storage_key: null, url }),
      ),
      /Unknown catalog sample photo/,
    );
  }
});

test("reads uploaded bytes through the bounded storage stream", async () => {
  const png = await new Image(1, 1).fill(0xff0000ff).encodePNG();
  serve(png);
  const result = await readCatalogEmbeddingImage(asset());
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(Uint8Array.from(result.bytes), png);
});

test("converts actual WebP to PNG without changing original bytes", async () => {
  const webp = await new Image(2, 2).fill(0xff0000ff).encodeWebP();
  const original = Uint8Array.from(webp);
  serve(webp);
  const result = await readCatalogEmbeddingImage(
    asset({ mime_type: "image/webp" }),
  );
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(
    [...result.bytes.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
  );
  const decoded = await Image.decode(result.bytes);
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 2);
  assert.deepEqual(webp, original);
});

test("rejects invalid and oversized bytes and trusts detected MIME", async () => {
  serve(new Uint8Array([1, 2, 3]));
  await assert.rejects(
    readCatalogEmbeddingImage(asset()),
    /unsupported format/,
  );
  serve(await new Image(1, 1).encodePNG());
  assert.equal(
    (await readCatalogEmbeddingImage(asset({ mime_type: "image/jpeg" })))
      .mimeType,
    "image/png",
  );
  serve(new Uint8Array(MAX_IMAGE_SIZE_BYTES + 1));
  await assert.rejects(readCatalogEmbeddingImage(asset()), /size limit/);
});

test("cancels an upload read and forwards the signal to Storage", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.signal, controller.signal);

    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(init.signal?.reason),
        { once: true },
      );
    });
  };
  const pending = readCatalogEmbeddingImage(asset(), controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
