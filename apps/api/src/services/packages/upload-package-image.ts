import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { randomUUID } from "node:crypto";
import { uploadImageToR2, type ImageContentType } from "../../utils/upload-image-to-r2.js";
import { cleanupImagesFromR2 } from "../../utils/r2-image-storage.js";

import { createPackageImageData } from "../../data/packages/create-package-image.js";

export async function uploadPackageImageService(db: Kysely<DB>, contentType: string, data: Buffer) {
  const id = randomUUID();
  const key = await uploadImageToR2("packages", data, contentType as ImageContentType, id);
  try {
    await createPackageImageData(db, id, contentType);
  } catch (cause) {
    await cleanupImagesFromR2([key]);
    throw cause;
  }
  return `/v1/package-images/${id}`;
}
