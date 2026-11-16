import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { archivePackageData } from "../../data/packages/archive-package.js";
import { lockPackageData } from "../../data/packages/lock-package.js";
import { packageDto } from "./package-response.js";
import { error, nextUpdate } from "./package-rules.js";
import { deleteCatalogKnowledgeData } from "../../data/ai/catalog-knowledge.js";
export async function archivePackageService(db: Kysely<DB>, id: string) {
  return db.transaction().execute(async (trx) => {
    const current = await lockPackageData(trx, id);
    if (!current) return error("Package not found", 404);
    const row = await archivePackageData(
      trx,
      id,
      current.archived_at ?? new Date(),
      nextUpdate(current.updated_at),
    );
    await deleteCatalogKnowledgeData(trx, { kind: "package", id });
    return packageDto(trx, row);
  });
}
