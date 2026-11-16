import type {
  Database,
  CatalogKnowledgeOwner,
} from "./catalog-knowledge-types.js";

export async function listCatalogKnowledgeOwnersData(
  db: Database,
): Promise<CatalogKnowledgeOwner[]> {
  const packages = await db
    .selectFrom("packages")
    .select("id")
    .where("package_type", "=", "catalog")
    .where("archived_at", "is", null)
    .orderBy("id")
    .execute();
  const services = await db
    .selectFrom("services")
    .select("id")
    .where("archived_at", "is", null)
    .orderBy("id")
    .execute();
  return [
    ...packages.map((row) => ({ kind: "package" as const, id: row.id })),
    ...services.map((row) => ({ kind: "service" as const, id: row.id })),
  ];
}
