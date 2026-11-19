import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { createServiceData } from "../../data/services/create-service.js";
import { serviceAdminDto } from "./service-response.js";
import { syncCatalogKnowledge } from "../ai/workflows/sync-catalog-knowledge.js";
import { enqueueBackgroundJobService } from "../background-jobs/enqueue-job.js";
import {
  InvalidCatalogMedia,
  replaceCatalogSectionsService,
} from "../catalog-canvas/replace-catalog-sections.js";
import { error } from "../packages/package-rules.js";
import { duplicateTitle, catalogTitle } from "../../utils/catalog-title.js";
import { findCatalogTitleData } from "../../data/catalog/find-catalog-title.js";
import { promoteOwnerCatalogMediaService } from "../catalog-media/promote-catalog-media.js";
export async function createServiceService(
  db: Kysely<DB>,
  data: ServiceContent,
  actorId: string,
) {
  if (
    !data.sections?.some((s) =>
      s.widgets.some((w) => w.type === "photo" && w.media),
    )
  )
    return error("A service photo is required", 400);
  try {
    const outcome = await db.transaction().execute(async (trx) => {
      const title = catalogTitle(data.name);
      if (await findCatalogTitleData(trx, "services", title))
        return error("A service with this title already exists", 409);
      const row = await createServiceData(trx, data, title.slug);
      await replaceCatalogSectionsService(
        trx,
        { kind: "service", id: row.id },
        { sections: data.sections ?? [] },
        actorId,
      );
      const chunks = await syncCatalogKnowledge(trx, {
        kind: "service",
        id: row.id,
      });
      if (chunks.length)
        await enqueueBackgroundJobService(trx, "embed_service", {
          serviceId: row.id,
        });
      return serviceAdminDto(trx, row);
    });
    if (!("status" in outcome)) {
      await promoteOwnerCatalogMediaService(db, {
        kind: "service",
        id: outcome.id,
      });
    }
    return outcome;
  } catch (cause) {
    const duplicate = duplicateTitle(
      cause,
      "A service with this title already exists",
    );
    if (duplicate) return duplicate;
    if (cause instanceof InvalidCatalogMedia) return error(cause.message, 400);
    throw cause;
  }
}
