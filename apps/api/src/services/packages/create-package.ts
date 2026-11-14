import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { createPackageData } from "../../data/packages/create-package.js";
import {
  InvalidPackageMedia,
  replacePackageSectionsData,
} from "../../data/packages/catalog-page.js";
import {
  validatePackageServicesData,
  replacePackageServicesData,
} from "../../data/packages/package-services.js";
import { packageDto } from "./package-response.js";
import { error } from "./package-rules.js";
import {
  duplicateTitle,
  reserveCatalogTitle,
} from "../../utils/catalog-title.js";
export async function createPackageService(
  db: Kysely<DB>,
  content: Content,
  actorId: string,
) {
  try {
    return await db.transaction().execute(async (trx) => {
      const title = await reserveCatalogTitle(trx, "packages", content.name);
      if (!title) return error("A package with this title already exists", 409);
      const invalid = await validatePackageServicesData(
        trx,
        null,
        content.services,
      );
      if (invalid) return invalid;
      const now = new Date();
      const row = await createPackageData(trx, content, title.slug, now);
      await replacePackageSectionsData(trx, row.id, content, actorId, now);
      await replacePackageServicesData(trx, row.id, content.services);
      return packageDto(trx, row, { includeArchivedServices: true });
    });
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
