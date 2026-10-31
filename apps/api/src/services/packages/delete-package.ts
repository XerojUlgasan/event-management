import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { deletePackageData } from "../../data/packages/delete-package.js";
import { lockPackageImagesData } from "../../data/packages/lock-package-images.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { findPublishedPackageHistoryData } from "../../data/packages/find-published-package-history.js";
import { deleteUnusedPackageImageData } from "../../data/packages/delete-unused-package-image.js";
import { listPackageVersionImageUrlsData } from "../../data/packages/list-package-version-image-urls.js";
import { cleanupImagesFromR2 } from "../../utils/r2-image-storage.js";

import { error } from "./package-rules.js";

export async function deletePackageService(db: Kysely<DB>, id: string) {
  try {
    const keys: string[] = [];
    const outcome = await db.transaction().execute(async trx => {
      const pkg = await lockPackageData(trx, id);
      if (!pkg) return error("Package not found", 404);
      if (await findPublishedPackageHistoryData(trx, pkg.id)) return error("Published packages cannot be deleted; archive instead", 409);
      const versions = await listPackageVersionImageUrlsData(trx, pkg.id);
      await lockPackageImagesData(trx, versions.map(version => version.image_url));
      await deletePackageData(trx, pkg.id);
      for (const version of versions) {
        const key = await deleteUnusedPackageImageData(trx, version.image_url);
        if (key) keys.push(key);
      }
      return null;
    });
    await cleanupImagesFromR2(keys);
    return outcome;
  } catch (cause) {
    if ((cause as { code?: string }).code === "23503") return error("Referenced packages cannot be deleted; archive instead", 409);
    throw cause;
  }
}
