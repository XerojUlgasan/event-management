import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, ShowcaseRecords } from "../../db/types.js";
import type {
  ShowcaseRecord,
  ShowcaseMediaItem,
} from "@event-management/contracts/showcase";
import { findShowcaseRecordWithMediaData } from "../../data/showcase-records/find-showcase-record-with-media.js";
import type { AssetRow } from "../../data/showcase-records/find-assets-for-records.js";
type Database = Kysely<DB> | Transaction<DB>;

/**
 * Returns the URL to use for a media asset in API responses.
 * Uploaded assets are served through the proxy; sample assets expose their
 * stored url directly (the proxy would redirect anyway, but this avoids a
 * round-trip and works correctly even before the redirect is followed).
 */
function assetUrl(id: string, asset: AssetRow | null): string {
  if (asset && asset.storage_key === null && asset.url) return asset.url;
  return `/v1/showcase-media/${id}`;
}

/** Builds the ShowcaseRecord response shape from a fetched record + its gallery. */
export function buildShowcaseDto(
  record: Selectable<ShowcaseRecords>,
  coverAsset: AssetRow | null,
  mediaRows: AssetRow[],
): ShowcaseRecord {
  const media: ShowcaseMediaItem[] = mediaRows.map((m) => ({
    id: m.id,
    kind: m.kind as "image" | "video",
    mimeType: m.mime_type ?? "",
    url: assetUrl(m.id, m),
  }));

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    coverMediaId: record.cover_media_id,
    coverUrl: assetUrl(record.cover_media_id, coverAsset),
    coverMimeType: coverAsset?.mime_type ?? "image/jpeg",
    publishedAt: record.published_at ? record.published_at.toISOString() : null,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString(),
    media,
  };
}

/** Loads a record with its gallery and returns the DTO, or null if not found. */
export async function showcaseDto(
  db: Database,
  lookup: { id: string } | { slug: string },
) {
  const result = await findShowcaseRecordWithMediaData(db, lookup);
  if (!result) return null;
  return buildShowcaseDto(result.record, result.coverAsset, result.mediaRows);
}
