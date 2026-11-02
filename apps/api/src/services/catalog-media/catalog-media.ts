import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos";
import { createCatalogMediaData, lockCatalogMediaData, catalogMediaReferencedData, deleteCatalogMediaData, staleCatalogMediaData } from "../../data/catalog-media/catalog-media.js";
import { detectCatalogMediaType, putCatalogMedia, deleteCatalogMedia } from "../../utils/catalog-media-storage.js";

export async function uploadCatalogMediaService(db: Kysely<DB>, actorId: string, file: File) {
  if (!file.size || file.size > MAX_VIDEO_SIZE_BYTES) return { status: 413 as const, message: "Choose a nonempty image up to 10 MiB or video up to 25 MiB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectCatalogMediaType(bytes);
  if (!detected || detected.mimeType !== file.type) return { status: 400 as const, message: "Choose a JPEG, PNG, WebP, MP4, or WebM file matching its content type." };
  if (detected.kind === "image" && file.size > MAX_IMAGE_SIZE_BYTES) return { status: 413 as const, message: "Images must be 10 MiB or smaller." };
  const id = randomUUID(), key = `catalog-media/${id}`;
  try { await putCatalogMedia(key, bytes, detected.mimeType); }
  catch { return { status: 502 as const, message: "Media upload failed. Try again." }; }
  try {
    await createCatalogMediaData(db, { id, kind: detected.kind, source: "upload", storage_key: key, mime_type: detected.mimeType, byte_size: file.size, created_by: actorId });
  } catch (error) { await deleteCatalogMedia(key).catch(() => {}); throw error; }
  // Recover uploads abandoned by a closed tab and retry prior storage cleanup.
  await cleanupStaleCatalogMediaService(db, 10);
  return { id, kind: detected.kind, source: "upload" as const, url: `/v1/catalog-media/${id}`, mimeType: detected.mimeType };
}
export async function removePendingCatalogMediaService(db: Kysely<DB>, id: string, actorId: string) {
  return db.transaction().execute(async trx => {
    const media = await lockCatalogMediaData(trx, id);
    if (!media || media.source !== "upload" || media.created_by !== actorId) return { status: 404 as const, message: "Pending upload not found." };
    if (await catalogMediaReferencedData(trx, id)) return { status: 409 as const, message: "This media is saved in a listing and cannot be discarded." };
    try { if (media.storage_key) await deleteCatalogMedia(media.storage_key); }
    catch { return { status: 502 as const, message: "Could not remove the upload. Try again." }; }
    await deleteCatalogMediaData(trx, id);
    return null;
  });
}
/** Called only with IDs removed by a successful save/delete. Row locks serialize
 * cleanup with attachment, so a concurrently attached object is never deleted. */
export async function cleanupCatalogMediaService(db: Kysely<DB>, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) {
    await db.transaction().execute(async trx => {
      const media = await lockCatalogMediaData(trx, id);
      if (!media || await catalogMediaReferencedData(trx, id)) return;
      if (media.storage_key) await deleteCatalogMedia(media.storage_key);
      await deleteCatalogMediaData(trx, id);
    }).catch(() => { console.warn("Unreferenced catalog media cleanup failed; retained for retry."); });
  }
}
export async function cleanupStaleCatalogMediaService(db: Kysely<DB>, limit = 100) {
  const rows = await staleCatalogMediaData(db, new Date(Date.now() - 24 * 60 * 60 * 1000), limit);
  await cleanupCatalogMediaService(db, rows.map(row => row.id));
  return rows.length;
}
