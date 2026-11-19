import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { updatePackageData } from "../../data/packages/update-package.js";
import {
  InvalidCatalogMedia,
  replaceCatalogSectionsService,
} from "../catalog-canvas/replace-catalog-sections.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import { packageDto } from "./package-response.js";
import { syncCatalogKnowledge } from "../ai/workflows/sync-catalog-knowledge.js";
import { enqueueBackgroundJobService } from "../background-jobs/enqueue-job.js";
import { error, nextUpdate } from "./package-rules.js";
import { duplicateTitle, catalogTitle } from "../../utils/catalog-title.js";
import { findCatalogTitleData } from "../../data/catalog/find-catalog-title.js";
import { promoteOwnerCatalogMediaService } from "../catalog-media/promote-catalog-media.js";
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
      const title = catalogTitle(content.name);
      if (await findCatalogTitleData(trx, "packages", title, id))
        return error("A package with this title already exists", 409);
      const now = nextUpdate(current.updated_at);
      const row = await updatePackageData(trx, id, content, title.slug, now);
      previousMediaIds = await replaceCatalogSectionsService(
        trx,
        { kind: "package", id },
        content,
        actorId,
      );
      if (current.thumbnail_media_id)
        previousMediaIds.push(current.thumbnail_media_id);
      const chunks = await syncCatalogKnowledge(trx, { kind: "package", id });
      if (chunks.length)
        await enqueueBackgroundJobService(trx, "embed_package", {
          packageId: id,
        });
      return packageDto(trx, row);
    });
    if (!("status" in outcome)) {
      await promoteOwnerCatalogMediaService(db, { kind: "package", id });
      await cleanupCatalogMediaService(db, previousMediaIds);
    }
    return outcome;
  } catch (cause) {
    const duplicate = duplicateTitle(
      cause,
      "A package with this title already exists",
    );
    if (duplicate) return duplicate;
    if (cause instanceof InvalidCatalogMedia) return error(cause.message, 400);
    throw cause;
  }
}
