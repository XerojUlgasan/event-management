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
import { r2Fixture } from "../helpers/r2-fixture.js";
import { setTestConfig } from "../helpers/set-test-config.js";

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

test("R2 missing keys are distinct from upstream failures", async () => {
  const oldFetch = globalThis.fetch;
  const oldEnv = Object.fromEntries(
    Object.keys(r2Fixture).map((name) => [name, process.env[name]]),
  );
  setTestConfig(r2Fixture);

  try {
    for (const response of [
      new Response(null, { status: 404 }),
      new Response("<Error><Code>NoSuchKey</Code></Error>", { status: 404 }),
    ]) {
      globalThis.fetch = async () => response;
      await assert.rejects(getCatalogMedia("old-key"), CatalogMediaNotFound);
    }

    globalThis.fetch = async () =>
      new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });
    await assert.rejects(
      getCatalogMedia("old-key"),
      (cause: unknown) =>
        cause instanceof Error && !(cause instanceof CatalogMediaNotFound),
    );
  } finally {
    globalThis.fetch = oldFetch;

    setTestConfig(oldEnv);
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
