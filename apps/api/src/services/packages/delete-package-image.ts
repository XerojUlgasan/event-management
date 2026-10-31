import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { checkPackageImageData } from "../../data/packages/check-package-image.js";
import { lockPackageImagesData } from "../../data/packages/lock-package-images.js";
import { deleteUnusedPackageImageData } from "../../data/packages/delete-unused-package-image.js";
import { cleanupImagesFromR2 } from "../../utils/r2-image-storage.js";

import { error } from "./package-rules.js";

export async function deletePackageImageService(db: Kysely<DB>, id: string) {
  const url = `/v1/package-images/${id}`;
  const outcome = await db.transaction().execute(async trx => {
    await lockPackageImagesData(trx, [url]);
    if (!await checkPackageImageData(trx, url)) return error("Image not found", 404);
    return await deleteUnusedPackageImageData(trx, url) ?? error("Image is referenced by a package version", 409);
  });
  if (typeof outcome !== "string") return outcome;
  await cleanupImagesFromR2([outcome]);
  return null;
}
