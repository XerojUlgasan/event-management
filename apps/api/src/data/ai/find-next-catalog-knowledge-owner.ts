import type {
  Database,
  CatalogKnowledgeOwner,
} from "./catalog-knowledge-types.js";

export async function findNextCatalogKnowledgeOwnerData(
  db: Database,
  position?: CatalogKnowledgeOwner & { inclusive: boolean },
): Promise<CatalogKnowledgeOwner | undefined> {
  if (!position || position.kind === "package") {
    let query = db
      .selectFrom("packages")
      .select("id")
      .where("package_type", "=", "catalog")
      .where("archived_at", "is", null);

    if (position)
      query = query.where("id", position.inclusive ? ">=" : ">", position.id);

    const row = await query.orderBy("id").limit(1).executeTakeFirst();

    if (row) return { kind: "package", id: row.id };
  }

  let query = db
    .selectFrom("services")
    .select("id")
    .where("archived_at", "is", null);

  if (position?.kind === "service")
    query = query.where("id", position.inclusive ? ">=" : ">", position.id);

  const row = await query.orderBy("id").limit(1).executeTakeFirst();

  return row ? { kind: "service", id: row.id } : undefined;
}
