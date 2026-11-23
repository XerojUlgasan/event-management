import type { Database } from "../catalog-canvas/catalog-canvas-types.js";

export async function getPublicCatalogItemData(
  db: Database,
  input: { catalogType: "package" | "service"; id: string },
) {
  if (input.catalogType === "package") {
    const row = await db
      .selectFrom("packages")
      .select([
        "id",
        "name",
        "slug",
        "description",
        "thumbnail_media_id",
        "updated_at",
        "price",
        "max_guests",
      ])
      .where("id", "=", input.id)
      .where("package_type", "=", "catalog")
      .where("archived_at", "is", null)
      .where("published_at", "is not", null)
      .executeTakeFirst();

    return row ? { type: "package" as const, ...row } : null;
  }

  const row = await db
    .selectFrom("services")
    .select([
      "id",
      "name",
      "slug",
      "description",
      "thumbnail_media_id",
      "updated_at",
      "fixed_price_pesos",
      "hourly_rate_pesos",
      "included_hours",
    ])
    .where("id", "=", input.id)
    .where("archived_at", "is", null)
    .executeTakeFirst();

  return row ? { type: "service" as const, ...row } : null;
}

export async function listPublicLinkedPackageIdsData(
  db: Database,
  ids: string[],
) {
  if (!ids.length) return new Set<string>();

  const rows = await db
    .selectFrom("packages")
    .select("id")
    .where("id", "in", ids)
    .where("package_type", "=", "catalog")
    .where("archived_at", "is", null)
    .where("published_at", "is not", null)
    .execute();

  return new Set(rows.map((row) => row.id));
}
