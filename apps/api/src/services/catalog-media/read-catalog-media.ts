import type { Database } from "../../data/catalog-canvas/catalog-canvas-types.js";
import { findCatalogMediaData } from "../../data/catalog-media/find-catalog-media.js";
import {
  CatalogMediaNotFound,
  getCatalogMedia,
} from "../../utils/catalog-media-storage.js";

// Call only after authorizing this media ID. Relocation changes its key, not
// its identity or bytes; a reader may have selected the key just before a move.
export async function readCatalogMediaService(
  db: Database,
  id: string,
  key: string,
  range?: string,
  signal?: AbortSignal,
) {
  try {
    return await getCatalogMedia(key, range, signal);
  } catch (cause) {
    if (!(cause instanceof CatalogMediaNotFound)) throw cause;
    const current = await findCatalogMediaData(db, id);
    if (!current?.storage_key || current.storage_key === key) throw cause;
    return getCatalogMedia(current.storage_key, range, signal);
  }
}
