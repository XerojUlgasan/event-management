import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Content } from "../../controllers/packages/schemas.js";
import { createPackageData } from "../../data/packages/create-package.js";
import {
  InvalidCatalogMedia,
  replaceCatalogSectionsService,
} from "../catalog-canvas/replace-catalog-sections.js";
import { packageDto } from "./package-response.js";
import { syncCatalogKnowledge } from "../ai/workflows/sync-catalog-knowledge.js";
import { scheduleCatalogEmbeddingRefresh } from "../ai/workflows/schedule-catalog-embedding-refresh.js";
import { error } from "./package-rules.js";
import { duplicateTitle, catalogTitle } from "../../utils/catalog-title.js";
import { findCatalogTitleData } from "../../data/catalog/find-catalog-title.js";
import { promoteOwnerCatalogMediaService } from "../catalog-media/promote-catalog-media.js";
export async function createPackageService(
  db: Kysely<DB>,
  content: Content,
  actorId: string,
) {
  try {
    const outcome = await db.transaction().execute(async (trx) => {
      const title = catalogTitle(content.name);
      if (await findCatalogTitleData(trx, "packages", title))
        return error("A package with this title already exists", 409);
      const now = new Date();
      const row = await createPackageData(trx, content, title.slug, now);
      await replaceCatalogSectionsService(
        trx,
        { kind: "package", id: row.id },
        content,
        actorId,
      );
      await syncCatalogKnowledge(trx, { kind: "package", id: row.id });
      return packageDto(trx, row);
    });
    if (!("status" in outcome)) {
      await promoteOwnerCatalogMediaService(db, {
        kind: "package",
        id: outcome.id,
      });
      await scheduleCatalogEmbeddingRefresh(db, [
        { kind: "package", id: outcome.id },
      ]);
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
