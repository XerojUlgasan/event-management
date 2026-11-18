import { archiveServiceData } from "../../data/services/archive-service.js";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { lockServiceData } from "../../data/services/lock-service.js";
import { error, nextUpdate } from "../packages/package-rules.js";
import { serviceAdminDto } from "./service-response.js";
import { deleteCatalogKnowledgeData } from "../../data/ai/delete-catalog-knowledge.js";
export async function archiveServiceService(db: Kysely<DB>, id: string) {
  const outcome = await db.transaction().execute(async (trx) => {
    const s = await lockServiceData(trx, id);
    if (!s) return error("Service not found", 404);
    const updated = await archiveServiceData(
      trx,
      id,
      s.archived_at ?? new Date(),
      nextUpdate(s.updated_at),
    );
    await deleteCatalogKnowledgeData(trx, { kind: "service", id });
    return serviceAdminDto(trx, updated);
  });
  return outcome;
}
