import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { MAX_IMAGE_SIZE_BYTES } from "@event-management/contracts/limits/images";
import { MAX_VIDEO_SIZE_BYTES } from "@event-management/contracts/limits/videos";
import { createCatalogMediaData } from "../../data/catalog-media/create-catalog-media.js";
import {
  detectCatalogMediaType,
  putCatalogMedia,
  deleteCatalogMedia,
} from "../../utils/catalog-media-storage.js";
import { cleanupStaleCatalogMediaService } from "./cleanup-stale-catalog-media.js";
import { pendingCatalogMediaKey } from "../../utils/catalog-media-paths.js";

type CatalogMediaUpload =
  | { status: 400 | 413 | 502; message: string }
  | {
      id: string;
      kind: "image" | "video";
      source: "upload";
      url: string;
      mimeType: string;
    };

export async function uploadCatalogMediaService(
  db: Kysely<DB>,
  actorId: string,
  file: File,
): Promise<CatalogMediaUpload> {
  if (!file.size || file.size > MAX_VIDEO_SIZE_BYTES)
    return {
      status: 413 as const,
      message: "Choose a nonempty image up to 10 MiB or video up to 25 MiB.",
    };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectCatalogMediaType(bytes);

  if (!detected || detected.mimeType !== file.type)
    return {
      status: 400 as const,
      message:
        "Choose a JPEG, PNG, WebP, MP4, or WebM file matching its content type.",
    };

  if (detected.kind === "image" && file.size > MAX_IMAGE_SIZE_BYTES)
    return {
      status: 413 as const,
      message: "Images must be 10 MiB or smaller.",
    };

  const id = randomUUID(),
    key = pendingCatalogMediaKey(actorId, id, detected.mimeType);

  try {
    await putCatalogMedia(key, bytes, detected.mimeType);
  } catch {
    return { status: 502 as const, message: "Media upload failed. Try again." };
  }

  try {
    await createCatalogMediaData(db, {
      id,
      kind: detected.kind,
      source: "upload",
      storage_key: key,
      mime_type: detected.mimeType,
      byte_size: file.size,
      created_by: actorId,
    });
  } catch (error) {
    await deleteCatalogMedia(key).catch(() => {});
    throw error;
  }

  // Recover uploads abandoned by a closed tab and retry prior storage cleanup.
  await cleanupStaleCatalogMediaService(db, 10);

  return {
    id,
    kind: detected.kind,
    source: "upload" as const,
    url: `/v1/catalog-media/${id}`,
    mimeType: detected.mimeType,
  };
}
