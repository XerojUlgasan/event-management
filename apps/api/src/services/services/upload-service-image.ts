import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { randomUUID } from "node:crypto";
import { uploadImageToR2, type ImageContentType } from "../../utils/upload-image-to-r2.js";
import { cleanupImagesFromR2 } from "../../utils/r2-image-storage.js";

import { createServiceImageData } from "../../data/services/create-service-image.js";

export async function uploadServiceImageService(db: Kysely<DB>, contentType: string, data: Buffer) {
  const id = randomUUID();
  const key = await uploadImageToR2("services", data, contentType as ImageContentType, id);
  try {
    await createServiceImageData(db, id, contentType);
  } catch (cause) {
    await cleanupImagesFromR2([key]);
    throw cause;
  }
  return `/v1/service-images/${id}`;
}
