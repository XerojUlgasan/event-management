import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { updatePackageData } from "../../data/packages/update-package.js";
import {
  InvalidPackageMedia,
  replacePackageSectionsData,
} from "../../data/packages/catalog-canvas.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import {
  validatePackageServicesData,
  replacePackageServicesData,
} from "../../data/packages/package-services.js";
import { packageDto } from "./package-response.js";
import { error, nextUpdate } from "./package-rules.js";
import {
  duplicateTitle,
  reserveCatalogTitle,
} from "../../utils/catalog-title.js";
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
      const invalid = await validatePackageServicesData(
        trx,
        id,
        content.services,
      );
      if (invalid) return invalid;
      const title = await reserveCatalogTitle(
        trx,
        "packages",
        content.name,
        id,
      );
      if (!title) return error("A package with this title already exists", 409);
      const now = nextUpdate(current.updated_at);
      const row = await updatePackageData(trx, id, content, title.slug, now);
      previousMediaIds = await replacePackageSectionsData(
        trx,
        id,
        content,
        actorId,
      );
      await replacePackageServicesData(trx, id, content.services);
      return packageDto(trx, row, { includeArchivedServices: true });
    });
    if (!("status" in outcome))
      await cleanupCatalogMediaService(db, previousMediaIds);
    return outcome;
  } catch (cause) {
    const duplicate = duplicateTitle(
      cause,
      "A package with this title already exists",
    );
    if (duplicate) return duplicate;
    if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
    throw cause;
  }
}
