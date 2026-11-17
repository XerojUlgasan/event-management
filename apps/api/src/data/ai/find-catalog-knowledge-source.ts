import type {
  Database,
  CatalogKnowledgeOwner,
} from "./catalog-knowledge-types.js";

export async function findCatalogKnowledgeSourceData(
  db: Database,
  owner: CatalogKnowledgeOwner,
) {
  if (owner.kind === "package") {
    const record = await db
      .selectFrom("packages")
      .selectAll()
      .where("id", "=", owner.id)
      .where("package_type", "=", "catalog")
      .where("archived_at", "is", null)
      .executeTakeFirst();
    if (!record) return null;
    return { kind: "package" as const, record };
  }
  const record = await db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", owner.id)
    .where("archived_at", "is", null)
    .executeTakeFirst();
  if (!record) return null;
  return {
    kind: "service" as const,
    record,
  };
}
