import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { lockCatalogMediaData } from "../../data/catalog-media/lock-catalog-media.js";
import { hasCatalogMediaReferenceData } from "../../data/catalog-media/has-catalog-media-reference.js";
import { deleteCatalogMediaData } from "../../data/catalog-media/delete-catalog-media.js";
import { deleteCatalogMediaObjectsService } from "./delete-catalog-media-objects.js";

export async function removePendingCatalogMediaService(
  db: Kysely<DB>,
  id: string,
  actorId: string,
) {
  return db.transaction().execute(async (trx) => {
    const media = await lockCatalogMediaData(trx, id);
    if (!media || media.source !== "upload" || media.created_by !== actorId)
      return { status: 404 as const, message: "Pending upload not found." };
    if (await hasCatalogMediaReferenceData(trx, id))
      return {
        status: 409 as const,
        message: "This media is saved in a listing and cannot be discarded.",
      };
    try {
      await deleteCatalogMediaObjectsService(media);
    } catch {
      return {
        status: 502 as const,
        message: "Could not remove the upload. Try again.",
      };
    }
    await deleteCatalogMediaData(trx, id);
    return null;
  });
}
