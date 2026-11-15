import type { Kysely, Selectable } from "kysely";
import type { DB, Packages, Services } from "../../db/types.js";

export type CatalogContextPackage = {
  id: string;
  name: string;
  description: string;
  pricePesos: number;
  maxGuests: number;
  slug: string;
  imageUrl: string | null;
};

export type CatalogContextService = {
  id: string;
  name: string;
  description: string;
  hourlyRatePesos: number | null;
  slug: string;
  imageUrl: string | null;
};

export type CatalogContext = {
  packages: CatalogContextPackage[];
  services: CatalogContextService[];
};

/** Resolves a media row into a publicly accessible URL. */
function resolveMediaUrl(
  mediaId: string,
  source: string,
  url: string | null,
): string {
  return source === "upload" ? `/v1/catalog-media/${mediaId}` : (url ?? "");
}

/** Fetches all published, non-archived catalog items to supply the AI with factual context.
 *  Includes the first photo image found on each item's canvas page. */
export async function listCatalogContextData(
  db: Kysely<DB>,
): Promise<CatalogContext> {
  const packages = await db
    .selectFrom("packages")
    .selectAll()
    .where("archived_at", "is", null)
    .where("package_type", "=", "catalog")
    .where("published_at", "is not", null)
    .where("name", "not like", "Scenario %")
    .orderBy("published_at", "desc")
    .limit(20)
    .execute();

  const services = await db
    .selectFrom("services")
    .selectAll()
    .where("archived_at", "is", null)
    .where("name", "not like", "Scenario %")
    .orderBy("published_at", "desc")
    .limit(20)
    .execute();

  // Fetch first photo widget for every package in one query.
  const packageImages = await db
    .selectFrom("catalog_pages as cp")
    .innerJoin("catalog_sections as cs", "cs.page_id", "cp.id")
    .innerJoin("catalog_widgets as w", "w.section_id", "cs.id")
    .innerJoin("media_assets as m", "m.id", "w.media_id")
    .select([
      "cp.package_id as item_id",
      "m.id as media_id",
      "m.source",
      "m.url",
    ])
    .where("cp.package_id", "is not", null)
    .where("w.type", "=", "photo")
    .where("m.kind", "=", "image")
    .orderBy("cp.package_id")
    .orderBy("cs.sort_order")
    .orderBy("w.sort_order")
    .execute();

  // Fetch first photo widget for every service in one query.
  const serviceImages = await db
    .selectFrom("catalog_pages as cp")
    .innerJoin("catalog_sections as cs", "cs.page_id", "cp.id")
    .innerJoin("catalog_widgets as w", "w.section_id", "cs.id")
    .innerJoin("media_assets as m", "m.id", "w.media_id")
    .select([
      "cp.service_id as item_id",
      "m.id as media_id",
      "m.source",
      "m.url",
    ])
    .where("cp.service_id", "is not", null)
    .where("w.type", "=", "photo")
    .where("m.kind", "=", "image")
    .orderBy("cp.service_id")
    .orderBy("cs.sort_order")
    .orderBy("w.sort_order")
    .execute();

  // Deduplicate — keep the first row per item.
  const firstPackageImage = new Map<string, string>();
  for (const row of packageImages) {
    if (row.item_id && !firstPackageImage.has(row.item_id)) {
      firstPackageImage.set(
        row.item_id,
        resolveMediaUrl(row.media_id, row.source, row.url),
      );
    }
  }

  const firstServiceImage = new Map<string, string>();
  for (const row of serviceImages) {
    if (row.item_id && !firstServiceImage.has(row.item_id)) {
      firstServiceImage.set(
        row.item_id,
        resolveMediaUrl(row.media_id, row.source, row.url),
      );
    }
  }

  return {
    packages: packages.map((p: Selectable<Packages>) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      pricePesos: p.price,
      maxGuests: p.max_guests,
      slug: p.slug,
      imageUrl: firstPackageImage.get(p.id) ?? null,
    })),
    services: services.map((s: Selectable<Services>) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      hourlyRatePesos: s.hourly_rate_pesos,
      slug: s.slug,
      imageUrl: firstServiceImage.get(s.id) ?? null,
    })),
  };
}
