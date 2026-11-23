import type { Kysely } from "kysely";
import { deleteShowcaseRecordData } from "../../data/showcase-records/delete-showcase-record.js";
import { lockShowcaseMediaData } from "../../data/showcase-records/lock-showcase-media.js";
import { lockShowcaseRecordData } from "../../data/showcase-records/lock-showcase-record.js";
import { replaceShowcaseGalleryData } from "../../data/showcase-records/replace-showcase-gallery.js";
import type { DB } from "../../db/types.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";

export async function deleteShowcaseRecordService(db: Kysely<DB>, id: string) {
  const removed = await db.transaction().execute(async (trx) => {
    const record = await lockShowcaseRecordData(trx, id);

    if (!record) return null;

    await lockShowcaseMediaData(trx, [], id);
    const gallery = await replaceShowcaseGalleryData(trx, id, []);
    await deleteShowcaseRecordData(trx, id);

    return [record.cover_media_id, ...gallery];
  });

  if (!removed) return false;

  await cleanupCatalogMediaService(db, removed);

  return true;
}
