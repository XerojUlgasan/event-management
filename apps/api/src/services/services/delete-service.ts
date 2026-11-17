import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { deleteServiceData } from "../../data/services/delete-service.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { error } from "../packages/package-rules.js";
import { listCatalogMediaIdsService } from "../catalog-canvas/read-catalog-sections.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import { invalidateDependentPackageKnowledgeData } from "../../data/ai/invalidate-dependent-package-knowledge.js";
import type { CatalogKnowledgeOwner } from "../../data/ai/catalog-knowledge-types.js";
import { scheduleCatalogEmbeddingRefresh } from "../ai/workflows/schedule-catalog-embedding-refresh.js";
import { hasCatalogListingReferenceData } from "../../data/catalog/has-catalog-listing-reference.js";
export async function deleteServiceService(db: Kysely<DB>, id: string) {
  let media: string[] = [];
  let dependents: CatalogKnowledgeOwner[] = [];
  try {
    const outcome = await db.transaction().execute(async (trx) => {
      const row = await lockServiceData(trx, id);
      if (!row) return error("Service not found", 404);
      if (
        await hasCatalogListingReferenceData(trx, {
          kind: "service",
          id: row.id,
        })
      )
        return error(
          "Referenced services cannot be deleted; archive instead",
          409,
        );
      media = await listCatalogMediaIdsService(trx, { kind: "service", id });
      dependents = await invalidateDependentPackageKnowledgeData(trx, id);
      await deleteServiceData(trx, id);
      return null;
    });
    if (!outcome) {
      await scheduleCatalogEmbeddingRefresh(db, dependents);
      await cleanupCatalogMediaService(db, media);
    }
    return outcome;
  } catch (cause) {
    if ((cause as { code?: string }).code === "23503")
      return error(
        "Referenced services cannot be deleted; archive instead",
        409,
      );
    throw cause;
  }
}
