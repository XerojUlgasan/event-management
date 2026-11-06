import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { updatePackageData } from "../../data/packages/update-package.js";
import {
  InvalidPackageMedia,
  replacePackageSectionsData,
} from "../../data/packages/catalog-page.js";
import {
  replacePackageServicesData,
  validatePackageServicesData,
} from "../../data/packages/package-services.js";
import { cleanupCatalogMediaService } from "../catalog-media/catalog-media.js";
import { packageDto } from "./package-response.js";
import { error, nextUpdate } from "./package-rules.js";
export async function updatePackageService(
  db: Kysely<DB>,
  id: string,
  content: Content & { expectedUpdatedAt: string },
  actorId: string,
) {
  try {
    let previousMediaIds: string[] = [];
    const outcome = await db.transaction().execute(async (trx) => {
      const current = await lockPackageData(trx, id);
      if (!current) return error("Package not found", 404);
      if (current.archived_at)
        return error("Archived packages cannot be edited", 409);
      if (current.updated_at.toISOString() !== content.expectedUpdatedAt)
        return error("Package changed. Refresh and try again", 409);
      const invalid = await validatePackageServicesData(trx, id, content.services);
      if (invalid) return invalid;
      const now = nextUpdate(current.updated_at);
      const row = await updatePackageData(trx, id, content, now);
      previousMediaIds = await replacePackageSectionsData(
        trx,
        id,
        content,
        actorId,
        now,
      );
      await replacePackageServicesData(trx, id, content.services);
      return packageDto(trx, row, { includeArchivedServices: true });
    });
    if (!("status" in outcome))
      await cleanupCatalogMediaService(db, previousMediaIds);
    return outcome;
  } catch (cause) {
    if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
    throw cause;
  }
}
