import type {
  Database,
  CatalogKnowledgeOwner,
} from "./catalog-knowledge-types.js";

export function listCatalogKnowledgeData(
  db: Database,
  owner: CatalogKnowledgeOwner,
) {
  return db
    .selectFrom("catalog_knowledge")
    .selectAll()
    .where(
      owner.kind === "package" ? "package_id" : "service_id",
      "=",
      owner.id,
    )
    .orderBy("chunk_key")
    .execute();
}
