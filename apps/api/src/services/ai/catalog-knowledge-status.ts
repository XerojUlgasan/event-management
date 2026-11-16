import type {
  KnowledgeChunk,
  KnowledgeListing,
} from "@event-management/contracts/catalog-knowledge";
import type { Selectable } from "kysely";
import type { MediaAssets } from "../../db/types.js";
import { sampleCatalogPhotoPaths } from "../../utils/sample-catalog-photos.js";
import { prepareCatalogKnowledge } from "./workflows/prepare-catalog-knowledge.js";
import {
  catalogKnowledgeDigest,
  catalogKnowledgeSourceHash,
} from "./catalog-knowledge-hash.js";

const model = "google/gemini-embedding-2";
type Asset = Selectable<MediaAssets>;
type Row = {
  chunk_key: string;
  content_markdown: string;
  content_hash: string;
  media_id: string | null;
  embedding_model: string | null;
  embedded_at: Date | null;
  has_embedding: boolean;
};
type Chunk = ReturnType<typeof prepareCatalogKnowledge>[number];

export function assessKnowledgeChunk(
  chunk: Chunk,
  row: Row | undefined,
  asset: Asset | undefined,
): KnowledgeChunk {
  const kind = chunk.chunkKey.startsWith("photo:") ? "photo" : "text";
  const sourceHash = catalogKnowledgeSourceHash(chunk.contentMarkdown, asset);
  const inputHash = row?.content_hash.slice(sourceHash.length + 1);
  const sourceMatches =
    row?.content_hash === sourceHash ||
    row?.content_hash.startsWith(`${sourceHash}:`);
  const mismatch =
    !!row &&
    (!sourceMatches ||
      row.content_markdown !== chunk.contentMarkdown ||
      row.media_id !== chunk.mediaId ||
      (kind === "photo" && (!asset || !chunk.mediaId)) ||
      (row.embedding_model !== null && row.embedding_model !== model));
  // Photo bytes are not re-downloaded on GET. The input digest is accepted under
  // immutable upload identity; sample-file replacement requires ingestion refresh.
  const digestMatches =
    !!inputHash &&
    /^[0-9a-f]{64}$/.test(inputHash) &&
    (kind === "photo" ||
      inputHash === catalogKnowledgeDigest(chunk.contentMarkdown));
  const indexed =
    !mismatch &&
    !!row?.has_embedding &&
    !!row.embedded_at &&
    row.embedding_model === model &&
    digestMatches;
  const invalidEmbedded = !!row?.has_embedding && !indexed;
  let mediaUrl: string | null = null;
  if (
    kind === "photo" &&
    (!row || row.media_id === chunk.mediaId) &&
    asset?.source === "upload"
  )
    mediaUrl = `/v1/catalog-media/${asset.id}`;
  else if (
    kind === "photo" &&
    (!row || row.media_id === chunk.mediaId) &&
    asset?.source === "sample" &&
    asset.url &&
    sampleCatalogPhotoPaths.includes(asset.url)
  )
    mediaUrl = asset.url;
  return {
    key: chunk.chunkKey,
    kind,
    withdrawn: false,
    status:
      mismatch || invalidEmbedded
        ? "needs-refresh"
        : indexed
          ? "indexed"
          : "pending",
    contentMarkdown: row?.content_markdown ?? chunk.contentMarkdown,
    mediaUrl,
    embeddedAt:
      row?.has_embedding && row.embedded_at
        ? row.embedded_at.toISOString()
        : null,
  };
}

export function assessKnowledgeListing(
  owner: { id: string; name: string; kind: "package" | "service" },
  expected: Chunk[],
  rows: Row[],
  assets: Map<string, Asset>,
) {
  const byKey = new Map(rows.map((row) => [row.chunk_key, row]));
  const chunks = expected.map((chunk) =>
    assessKnowledgeChunk(
      chunk,
      byKey.get(chunk.chunkKey),
      chunk.mediaId ? assets.get(chunk.mediaId) : undefined,
    ),
  );
  const expectedKeys = new Set(expected.map((chunk) => chunk.chunkKey));
  const extra = rows.some((row) => !expectedKeys.has(row.chunk_key));
  const indexedChunks = chunks.filter(
    (chunk) => chunk.status === "indexed",
  ).length;
  const status =
    extra || chunks.some((chunk) => chunk.status === "needs-refresh")
      ? "needs-refresh"
      : indexedChunks === chunks.length && chunks.length > 0
        ? "indexed"
        : indexedChunks > 0
          ? "partial"
          : "pending";
  // Listing time covers expected source chunks; withdrawn rows are separate.
  const timestamps = chunks
    .flatMap((chunk) => (chunk.embeddedAt ? [chunk.embeddedAt] : []))
    .sort();
  const listing: KnowledgeListing = {
    ...owner,
    status,
    indexedChunks,
    expectedChunks: chunks.length,
    textChunks: chunks.filter((chunk) => chunk.kind === "text").length,
    photoChunks: chunks.filter((chunk) => chunk.kind === "photo").length,
    lastIndexedAt: timestamps.at(-1) ?? null,
  };
  const withdrawn: KnowledgeChunk[] = rows
    .filter((row) => !expectedKeys.has(row.chunk_key))
    .map((row) => ({
      key: row.chunk_key,
      kind: row.chunk_key.startsWith("photo:") ? "photo" : "text",
      withdrawn: true,
      status: "needs-refresh",
      contentMarkdown: row.content_markdown,
      mediaUrl: null,
      embeddedAt: row.embedded_at?.toISOString() ?? null,
    }));
  return { listing, chunks: [...chunks, ...withdrawn] };
}
