import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { checkServiceImageData } from "../../data/services/check-service-image.js";
import { lockServiceImagesData } from "../../data/services/lock-service-images.js";
import { deleteUnusedServiceImageData } from "../../data/services/delete-unused-service-image.js";

import { error } from "../packages/package-rules.js";

export async function deleteServiceImageService(db: Kysely<DB>, id: string) {
  const url = `/v1/service-images/${id}`;
  return db.transaction().execute(async trx => {
    await lockServiceImagesData(trx, [url]);
    if (!await checkServiceImageData(trx, url)) return error("Image not found", 404);
    if (!await deleteUnusedServiceImageData(trx, url)) return error("Image is referenced by a service version", 409);
    return null;
  });
}
