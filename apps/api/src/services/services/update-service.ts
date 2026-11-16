import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { updateServiceData } from "../../data/services/update-service.js";
import { error, nextUpdate } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
import { syncCatalogKnowledge } from "../ai/retrieval/sync-catalog-knowledge.js";
import { scheduleCatalogEmbeddingRefresh } from "../ai/retrieval/refresh-catalog-embeddings.js";
import {
  invalidateDependentPackageKnowledgeData,
  type CatalogKnowledgeOwner,
} from "../../data/ai/catalog-knowledge.js";
import {
  InvalidPackageMedia,
  readCatalogSectionsData,
  replaceCatalogSectionsData,
} from "../../data/packages/catalog-canvas.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import {
  duplicateTitle,
  reserveCatalogTitle,
} from "../../utils/catalog-title.js";
export async function updateServiceService(
  db: Kysely<DB>,
  id: string,
  data: ServiceContent & { expectedUpdatedAt: string },
  actorId: string,
) {
  let previousMedia: string[] = [];
  let dependents: CatalogKnowledgeOwner[] = [];
  try {
    const outcome = await db.transaction().execute(async (trx) => {
      const current = await lockServiceData(trx, id);
      if (!current) return error("Service not found", 404);
      if (current.archived_at)
        return error("Archived services cannot be edited", 409);
      if (current.updated_at.toISOString() !== data.expectedUpdatedAt)
        return error("Service changed. Refresh and try again", 409);
      const sections =
        data.sections ??
        (await readCatalogSectionsData(trx, { kind: "service", id }));
      if (
        !sections.some((s) =>
          s.widgets.some((w) => w.type === "photo" && w.media),
        )
      )
        return error("A service photo is required", 400);
      const title = await reserveCatalogTitle(trx, "services", data.name, id);
      if (!title) return error("A service with this title already exists", 409);
      const now = nextUpdate(current.updated_at);
      const row = await updateServiceData(trx, id, data, title.slug, now);
      if (data.sections !== undefined)
        previousMedia = await replaceCatalogSectionsData(
          trx,
          { kind: "service", id },
          { sections },
          actorId,
        );
      await syncCatalogKnowledge(trx, { kind: "service", id });
      if (current.name !== row.name)
        dependents = await invalidateDependentPackageKnowledgeData(trx, id);
      return serviceAdminDto(trx, row);
    });
    if (!("status" in outcome)) {
      await scheduleCatalogEmbeddingRefresh(db, [
        { kind: "service", id },
        ...dependents,
      ]);
      await cleanupCatalogMediaService(db, previousMedia);
    }
    return outcome;
  } catch (cause) {
    const duplicate = duplicateTitle(
      cause,
      "A service with this title already exists",
    );
    if (duplicate) return duplicate;
    if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
    throw cause;
  }
}
