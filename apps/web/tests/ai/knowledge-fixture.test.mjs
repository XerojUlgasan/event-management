import { test } from "node:test";
import { strict as assert } from "node:assert";
// Synthetic browser fixture: expected package and service coverage 1/3 (33.3%),
// attention 4/6, and current/expected chunks 7/14. Never used by the app.
const listing = (id, kind, name, status, indexedChunks, expectedChunks) => ({
  id,
  kind,
  name,
  status,
  indexedChunks,
  expectedChunks,
  textChunks: expectedChunks,
  photoChunks: 0,
  lastIndexedAt: indexedChunks ? "2026-11-16T00:00:00.000Z" : null,
});
export const listings = [
  listing("p1", "package", "Classic", "indexed", 4, 4),
  listing("p2", "package", "Garden", "partial", 1, 3),
  listing("p3", "package", "Modern", "pending", 0, 2),
  listing("s1", "service", "Flowers", "indexed", 2, 2),
  listing("s2", "service", "Music", "needs-refresh", 0, 2),
  listing("s3", "service", "Photography", "pending", 0, 1),
];
export const summary = {
  packages: { total: 3, indexed: 1 },
  services: { total: 3, indexed: 1 },
  attention: 4,
  total: 6,
};
export const detail = (item) => ({
  listing: item,
  chunks: Array.from({ length: item.expectedChunks }, (_, i) => ({
    key: `${item.id}-${i}`,
    withdrawn: false,
    kind: "text",
    status:
      i < item.indexedChunks
        ? "indexed"
        : item.status === "needs-refresh"
          ? "needs-refresh"
          : "pending",
    contentMarkdown: `Content ${i + 1}`,
    mediaUrl: null,
    embeddedAt: i < item.indexedChunks ? item.lastIndexedAt : null,
  })),
  nextCursor: null,
});

test("synthetic knowledge totals", () => {
  assert.deepEqual(
    listings.filter(
      (item) => item.kind === "package" && item.status === "indexed",
    ).length,
    summary.packages.indexed,
  );
  assert.deepEqual(
    listings.filter(
      (item) => item.kind === "service" && item.status === "indexed",
    ).length,
    summary.services.indexed,
  );
  assert.equal(
    listings.filter((item) => item.status !== "indexed").length,
    summary.attention,
  );
  assert.deepEqual(
    listings.reduce(
      (sum, item) => [
        sum[0] + item.indexedChunks,
        sum[1] + item.expectedChunks,
      ],
      [0, 0],
    ),
    [7, 14],
  );
});
