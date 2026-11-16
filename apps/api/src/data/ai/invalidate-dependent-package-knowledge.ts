import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { CatalogKnowledgeOwner } from "./catalog-knowledge-types.js";

export async function invalidateDependentPackageKnowledgeData(
  trx: Transaction<DB>,
  serviceId: string,
): Promise<CatalogKnowledgeOwner[]> {
  const packages = await trx
    .selectFrom("package_services as ps")
    .innerJoin("packages as p", "p.id", "ps.package_id")
    .select("p.id")
    .where("ps.service_id", "=", serviceId)
    .where("p.package_type", "=", "catalog")
    .where("p.archived_at", "is", null)
    .orderBy("p.id")
    .execute();
  // Do not lock package owners here: package saves lock package -> services.
  for (const row of packages) {
    await trx
      .deleteFrom("catalog_knowledge")
      .where("package_id", "=", row.id)
      .where((eb) =>
        eb.or([
          eb("chunk_key", "=", "overview"),
          eb("chunk_key", "like", "overview:%"),
        ]),
      )
      .execute();
  }
  return packages.map((row) => ({ kind: "package", id: row.id }));
}
