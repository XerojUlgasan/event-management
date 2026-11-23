import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, ShowcaseRecords } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export type MediaRow = {
  id: string;
  kind: string;
  mime_type: string | null;
  sort_order: number;
  storage_key: string | null;
  /** Set for sample assets; null for uploaded assets. */
  url: string | null;
};

export type AssetRow = {
  id: string;
  kind: string;
  mime_type: string | null;
  storage_key: string | null;
  url: string | null;
};

type ShowcaseWithMedia = {
  record: Selectable<ShowcaseRecords>;
  coverAsset: AssetRow | null;
  previewAsset: AssetRow | null;
  mediaRows: MediaRow[];
};

/** Fetch one record (by id or slug) with its cover, preview video, and ordered gallery rows. */
export async function findShowcaseRecordWithMediaData(
  db: Database,
  lookup: { id: string } | { slug: string },
): Promise<ShowcaseWithMedia | null> {
  let recordQuery = db
    .selectFrom("showcase_records")
    .selectAll();
  if ("id" in lookup) {
    recordQuery = recordQuery.where("id", "=", lookup.id);
  } else {
    recordQuery = recordQuery.where("slug", "=", lookup.slug);
  }
  const record = await recordQuery.executeTakeFirst();
  if (!record) return null;

  // Collect all referenced asset IDs in one query.
  const assetIds = [
    record.cover_media_id,
    ...(record.preview_video_id ? [record.preview_video_id] : []),
  ];

  const assets = await db
    .selectFrom("media_assets as m")
    .select(["m.id", "m.kind", "m.mime_type", "m.storage_key", "m.url"])
    .where("m.id", "in", assetIds)
    .execute();

  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const coverAsset = assetMap.get(record.cover_media_id) ?? null;
  const previewAsset =
    record.preview_video_id ? (assetMap.get(record.preview_video_id) ?? null) : null;

  const mediaRows = await db
    .selectFrom("showcase_record_media as srm")
    .innerJoin("media_assets as m", "m.id", "srm.media_id")
    .select([
      "srm.media_id as id",
      "srm.sort_order",
      "m.kind",
      "m.mime_type",
      "m.storage_key",
      "m.url",
    ])
    .where("srm.record_id", "=", record.id)
    .orderBy("srm.sort_order", "asc")
    .execute();

  return { record, coverAsset, previewAsset, mediaRows };
}
