import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogKnowledgeSourceHash } from "../../src/services/ai/catalog-knowledge-hash.js";
import {
  getCatalogMedia,
  CatalogMediaNotFound,
} from "../../src/utils/catalog-media-storage.js";
import {
  ownedCatalogMediaKey,
  pendingCatalogMediaKey,
} from "../../src/utils/catalog-media-paths.js";

test("filing preserves uploaded photo freshness across folders", () => {
  const media = {
    id: "media-id",
    source: "upload",
    storage_key: "catalog-media/media-id",
    url: null,
    mime_type: "image/png",
  };
  const legacy = catalogKnowledgeSourceHash("photo context", media);
  for (const storage_key of [
    pendingCatalogMediaKey("admin-id", media.id, media.mime_type),
    ownedCatalogMediaKey(
      { kind: "package", id: "package-id" },
      { ...media, kind: "image" },
    ),
    ownedCatalogMediaKey(
      { kind: "booking", id: "booking-id" },
      { ...media, kind: "image" },
    ),
  ])
    assert.equal(
      catalogKnowledgeSourceHash("photo context", { ...media, storage_key }),
      legacy,
    );
  assert.notEqual(catalogKnowledgeSourceHash("changed caption", media), legacy);
  assert.notEqual(
    catalogKnowledgeSourceHash("photo context", {
      ...media,
      id: "new-media-id",
    }),
    legacy,
  );
});

test("Storage missing-key detection accepts both response formats without hiding other failures", async () => {
  const oldFetch = globalThis.fetch;
  const oldEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.SUPABASE_URL = "http://storage.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-fixture";
  try {
    for (const response of [
      new Response(null, { status: 404 }),
      Response.json({ code: "NoSuchKey", statusCode: "404" }, { status: 400 }),
    ]) {
      globalThis.fetch = async () => response;
      await assert.rejects(getCatalogMedia("old-key"), CatalogMediaNotFound);
    }
    globalThis.fetch = async () =>
      Response.json({ code: "InvalidJWT" }, { status: 400 });
    await assert.rejects(
      getCatalogMedia("old-key"),
      (cause: unknown) =>
        cause instanceof Error && !(cause instanceof CatalogMediaNotFound),
    );
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("paths use MIME extensions for every accepted upload format", () => {
  for (const [mime_type, extension, kind] of [
    ["image/jpeg", "jpg", "image"],
    ["image/png", "png", "image"],
    ["image/webp", "webp", "image"],
    ["video/mp4", "mp4", "video"],
    ["video/webm", "webm", "video"],
  ]) {
    assert.ok(mime_type && extension && kind);
    assert.equal(
      pendingCatalogMediaKey("admin-id", "media-id", mime_type),
      `pending/admin-id/media-id.${extension}`,
    );
    assert.equal(
      ownedCatalogMediaKey(
        { kind: "service", id: "service-id" },
        { id: "media-id", mime_type, kind },
      ),
      `services/service-id/${kind === "image" ? "images" : "videos"}/media-id.${extension}`,
    );
  }
});
