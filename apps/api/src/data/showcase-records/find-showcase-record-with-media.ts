import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, ShowcaseRecords } from "../../db/types.js";
import {
  findAssetsForRecordsData,
  type AssetRow,
} from "./find-assets-for-records.js";
import { findGalleryForRecordsData } from "./find-gallery-for-records.js";

type Database = Kysely<DB> | Transaction<DB>;

type ShowcaseWithMedia = {
  record: Selectable<ShowcaseRecords>;
  coverAsset: AssetRow | null;
  mediaRows: AssetRow[];
};

/** Fetch one record by ID or slug with its cover and ordered gallery. */
export async function findShowcaseRecordWithMediaData(
  db: Database,
  lookup: { id: string } | { slug: string },
): Promise<ShowcaseWithMedia | null> {
  let recordQuery = db.selectFrom("showcase_records").selectAll();

  if ("id" in lookup) {
    recordQuery = recordQuery.where("id", "=", lookup.id);
  } else {
    recordQuery = recordQuery.where("slug", "=", lookup.slug);
  }

  const record = await recordQuery.executeTakeFirst();

  if (!record) return null;

  const assets = await findAssetsForRecordsData(db, [record]);
  const galleries = await findGalleryForRecordsData(db, [record.id]);

  return {
    record,
    coverAsset: assets.get(record.cover_media_id) ?? null,
    mediaRows: galleries.get(record.id) ?? [],
  };
}
