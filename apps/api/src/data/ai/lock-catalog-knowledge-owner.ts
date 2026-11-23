import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { CatalogKnowledgeOwner } from "./catalog-knowledge-types.js";

export async function lockCatalogKnowledgeOwnerData(
  trx: Transaction<DB>,
  owner: CatalogKnowledgeOwner,
) {
  const table = owner.kind === "package" ? "packages" : "services";
  const row = await trx
    .selectFrom(table)
    .select("id")
    .where("id", "=", owner.id)
    .forUpdate()
    .executeTakeFirst();

  if (!row) return false;

  return true;
}
