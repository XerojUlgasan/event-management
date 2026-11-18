import type { Selectable } from "kysely";
import type { MediaAssets } from "../../db/types.js";
import { deleteCatalogMedia } from "../../utils/catalog-media-storage.js";
import {
  pendingCatalogMediaKey,
  isCatalogMediaMimeType,
} from "../../utils/catalog-media-paths.js";

// Caller holds the media lock and has checked that no listing references it.
// A completed promotion can leave its pending copy if deletion failed.
export async function deleteCatalogMediaObjectsService(
  media: Selectable<MediaAssets>,
) {
  const pendingKey =
    media.created_by &&
    media.mime_type &&
    isCatalogMediaMimeType(media.mime_type)
      ? pendingCatalogMediaKey(media.created_by, media.id, media.mime_type)
      : null;
  const keys = [media.storage_key, pendingKey];
  for (const key of new Set(keys)) {
    if (key) await deleteCatalogMedia(key);
  }
}
