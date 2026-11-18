import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { lockCatalogMediaData } from "../../data/catalog-media/lock-catalog-media.js";
import { hasCatalogMediaReferenceData } from "../../data/catalog-media/has-catalog-media-reference.js";
import { deleteCatalogMediaData } from "../../data/catalog-media/delete-catalog-media.js";
import { deleteCatalogMediaObjectsService } from "./delete-catalog-media-objects.js";

/** Called only with IDs removed by a successful save/delete. Row locks serialize
 * cleanup with attachment, so a concurrently attached object is never deleted. */
export async function cleanupCatalogMediaService(
  db: Kysely<DB>,
  ids: string[],
) {
  for (const id of [...new Set(ids)].sort()) {
    await db
      .transaction()
      .execute(async (trx) => {
        const media = await lockCatalogMediaData(trx, id);
        if (!media || (await hasCatalogMediaReferenceData(trx, id))) return;
        await deleteCatalogMediaObjectsService(media);
        await deleteCatalogMediaData(trx, id);
      })
      .catch(() => {
        console.warn(
          "Unreferenced catalog media cleanup failed; retained for retry.",
        );
      });
  }
}
