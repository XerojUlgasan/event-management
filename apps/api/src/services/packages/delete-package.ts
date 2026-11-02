import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { deletePackageData } from "../../data/packages/delete-package.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { hasPackageBookingReferenceData } from "../../data/packages/has-booking-reference.js";
import { listPackageMediaIdsData } from "../../data/packages/catalog-page.js";
import { cleanupCatalogMediaService } from "../catalog-media/catalog-media.js";
import { error } from "./package-rules.js";
export async function deletePackageService(db: Kysely<DB>, id: string) {
  try {
    let previousMediaIds: string[] = [];
    const outcome = await db.transaction().execute(async (trx) => {
      const current = await lockPackageData(trx, id);
      if (!current) return error("Package not found", 404);
      if (await hasPackageBookingReferenceData(trx, id))
        return error(
          "Referenced packages cannot be deleted; archive instead",
          409,
        );
      previousMediaIds = await listPackageMediaIdsData(trx, id);
      await deletePackageData(trx, id);
      return null;
    });
    if (!outcome) await cleanupCatalogMediaService(db, previousMediaIds);
    return outcome;
  } catch (cause) {
    if ((cause as { code?: string }).code === "23503")
      return error(
        "Referenced packages cannot be deleted; archive instead",
        409,
      );
    throw cause;
  }
}
