import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { createPackageData } from "../../data/packages/create-package.js";
import {
  InvalidPackageMedia,
  replacePackageSectionsData,
} from "../../data/packages/catalog-page.js";
import {
  replacePackageServicesData,
  validatePackageServicesData,
} from "../../data/packages/package-services.js";
import { packageDto } from "./package-response.js";
import { error } from "./package-rules.js";
export async function createPackageService(
  db: Kysely<DB>,
  content: Content,
  actorId: string,
) {
  try {
    return await db.transaction().execute(async (trx) => {
      const invalid = await validatePackageServicesData(trx, null, content.services);
      if (invalid) return invalid;
      const now = new Date();
      const row = await createPackageData(trx, content, now);
      await replacePackageSectionsData(trx, row.id, content, actorId, now);
      await replacePackageServicesData(trx, row.id, content.services);
      return packageDto(trx, row, { includeArchivedServices: true });
    });
  } catch (cause) {
    if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
    throw cause;
  }
}
