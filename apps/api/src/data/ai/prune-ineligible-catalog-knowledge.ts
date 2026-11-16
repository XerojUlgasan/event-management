import type { Database } from "./catalog-knowledge-types.js";

export function pruneIneligibleCatalogKnowledgeData(db: Database) {
  return db
    .deleteFrom("catalog_knowledge")
    .where((eb) =>
      eb.or([
        eb.and([
          eb("package_id", "is not", null),
          eb.not(
            eb.exists(
              eb
                .selectFrom("packages as p")
                .select("p.id")
                .whereRef("p.id", "=", "catalog_knowledge.package_id")
                .where("p.package_type", "=", "catalog")
                .where("p.archived_at", "is", null),
            ),
          ),
        ]),
        eb.and([
          eb("service_id", "is not", null),
          eb.not(
            eb.exists(
              eb
                .selectFrom("services as s")
                .select("s.id")
                .whereRef("s.id", "=", "catalog_knowledge.service_id")
                .where("s.archived_at", "is", null),
            ),
          ),
        ]),
      ]),
    )
    .execute();
}
