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
  if (owner.kind === "package") {
    await trx
      .selectFrom("services")
      .select("services.id")
      .where(
        "services.id",
        "in",
        trx
          .selectFrom("package_services")
          .select("service_id")
          .where("package_id", "=", owner.id),
      )
      .orderBy("services.id")
      .forUpdate()
      .execute();
  }
  return true;
}
