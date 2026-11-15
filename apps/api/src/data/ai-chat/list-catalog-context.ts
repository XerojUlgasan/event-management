import type { Kysely, Selectable } from "kysely";
import type { DB, Packages, Services } from "../../db/types.js";

export type CatalogContextPackage = {
  id: string;
  name: string;
  description: string;
  pricePesos: number;
  maxGuests: number;
  slug: string;
};

export type CatalogContextService = {
  id: string;
  name: string;
  description: string;
  hourlyRatePesos: number | null;
  slug: string;
};

export type CatalogContext = {
  packages: CatalogContextPackage[];
  services: CatalogContextService[];
};

function packageToContext(p: Selectable<Packages>): CatalogContextPackage {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    pricePesos: p.price,
    maxGuests: p.max_guests,
    slug: p.slug,
  };
}

function serviceToContext(s: Selectable<Services>): CatalogContextService {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    hourlyRatePesos: s.hourly_rate_pesos,
    slug: s.slug,
  };
}

/** Fetches all published, non-archived catalog items to supply the AI with factual context. */
export async function listCatalogContextData(
  db: Kysely<DB>,
): Promise<CatalogContext> {
  const packages = await db
    .selectFrom("packages")
    .selectAll()
    .where("archived_at", "is", null)
    .where("package_type", "=", "catalog")
    .where("published_at", "is not", null)
    .orderBy("published_at", "desc")
    .execute();

  const services = await db
    .selectFrom("services")
    .selectAll()
    .where("archived_at", "is", null)
    .orderBy("published_at", "desc")
    .execute();

  return {
    packages: packages.map(packageToContext),
    services: services.map(serviceToContext),
  };
}
