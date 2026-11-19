import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { updateServiceData } from "../../data/services/update-service.js";
import { error, nextUpdate } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
import { syncCatalogKnowledge } from "../ai/workflows/sync-catalog-knowledge.js";
import { enqueueBackgroundJobService } from "../background-jobs/enqueue-job.js";
import { readCatalogSectionsService } from "../catalog-canvas/read-catalog-sections.js";
import {
  InvalidCatalogMedia,
  replaceCatalogSectionsService,
} from "../catalog-canvas/replace-catalog-sections.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import { duplicateTitle, catalogTitle } from "../../utils/catalog-title.js";
import { findCatalogTitleData } from "../../data/catalog/find-catalog-title.js";
import { promoteOwnerCatalogMediaService } from "../catalog-media/promote-catalog-media.js";
export async function updateServiceService(
  db: Kysely<DB>,
  id: string,
  data: ServiceContent & { expectedUpdatedAt: string },
  actorId: string,
) {
  let previousMedia: string[] = [];
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
        (await readCatalogSectionsService(trx, { kind: "service", id }));
      if (
        !sections.some((s) =>
          s.widgets.some((w) => w.type === "photo" && w.media),
        )
      )
        return error("A service photo is required", 400);
      const title = catalogTitle(data.name);
      if (await findCatalogTitleData(trx, "services", title, id))
        return error("A service with this title already exists", 409);
      const now = nextUpdate(current.updated_at);
      const row = await updateServiceData(trx, id, data, title.slug, now);
      if (data.sections !== undefined)
        previousMedia = await replaceCatalogSectionsService(
          trx,
          { kind: "service", id },
          { sections },
          actorId,
        );
      if (current.thumbnail_media_id)
        previousMedia.push(current.thumbnail_media_id);
      const chunks = await syncCatalogKnowledge(trx, { kind: "service", id });
      if (chunks.length)
        await enqueueBackgroundJobService(trx, "embed_service", {
          serviceId: id,
        });
      return serviceAdminDto(trx, row);
    });
    if (!("status" in outcome)) {
      await promoteOwnerCatalogMediaService(db, { kind: "service", id });
      await cleanupCatalogMediaService(db, previousMedia);
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
