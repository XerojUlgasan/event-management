import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { createPackageData } from "../../data/packages/create-package.js";
import {
  InvalidPackageMedia,
  replacePackageSectionsData,
} from "../../data/packages/catalog-canvas.js";
import {
  validatePackageServicesData,
  replacePackageServicesData,
} from "../../data/packages/package-services.js";
import { packageDto } from "./package-response.js";
import { syncCatalogKnowledge } from "../ai/workflows/sync-catalog-knowledge.js";
import { scheduleCatalogEmbeddingRefresh } from "../ai/workflows/schedule-catalog-embedding-refresh.js";
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
    const outcome = await db.transaction().execute(async (trx) => {
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
      await replacePackageSectionsData(trx, row.id, content, actorId);
      await replacePackageServicesData(trx, row.id, content.services);
      await syncCatalogKnowledge(trx, { kind: "package", id: row.id });
      return packageDto(trx, row, { includeArchivedServices: true });
    });
    if (!("status" in outcome))
      await scheduleCatalogEmbeddingRefresh(db, [
        { kind: "package", id: outcome.id },
      ]);
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
