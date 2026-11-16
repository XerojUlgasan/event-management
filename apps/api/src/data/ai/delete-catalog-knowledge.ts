import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { CatalogKnowledgeOwner } from "./catalog-knowledge-types.js";

export function deleteCatalogKnowledgeData(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
) {
  return trx
    .deleteFrom("catalog_knowledge")
    .where(
      owner.kind === "package" ? "package_id" : "service_id",
      "=",
      owner.id,
    )
    .execute();
}
