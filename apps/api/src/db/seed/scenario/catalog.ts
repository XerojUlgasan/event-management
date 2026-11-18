import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { sql } from "kysely";
import type { SeedDb } from "../context.js";
import { insertIfNew, scenarioId } from "../context.js";
import {
  buildCatalogCanvas,
  curatedPackages,
  curatedServices,
} from "../curated-catalog.js";
import type { CatalogCopy } from "../curated-catalog.js";
import type { ScenarioUser } from "./users.js";

const SAMPLE_PHOTOS = [
  "/images/wedding.jpg",
  "/images/dinner.jpg",
  "/images/dessert.jpg",
  "/images/hero.jpg",
];

export type ScenarioPackage = {
  id: string;
  name: string;
  slug: string;
  price: number;
  maxGuests: number;
  archived: boolean;
};
export type ScenarioService = {
  id: string;
  name: string;
  hourlyRatePesos: number | null;
  archived: boolean;
};
export type ScenarioCatalog = {
  packages: ScenarioPackage[];
  services: ScenarioService[];
};
type CanvasPlan = {
  key: string;
  kind: "package" | "service";
  ownerId: string;
  copy: CatalogCopy;
  index: number;
};

export function planScenarioCatalog(): ScenarioCatalog & {
  canvases: CanvasPlan[];
} {
  const packages = curatedPackages.map((copy, index) => ({
    id: scenarioId(`package:${index}`),
    name: copy.name,
    slug: catalogSlug(copy.name),
    price: copy.price,
    maxGuests: copy.guests,
    archived: index >= 18,
  }));
  const services = curatedServices.map((copy, index) => ({
    id: scenarioId(`service:${index}`),
    name: copy.name,
    hourlyRatePesos: copy.rate,
    archived: index >= 18,
  }));
  const canvases: CanvasPlan[] = [
    ...packages.map((owner, index) => ({
      key: `package:${index}`,
      kind: "package" as const,
      ownerId: owner.id,
      copy: curatedPackages[index],
      index,
    })),
    ...services.map((owner, index) => ({
      key: `service:${index}`,
      kind: "service" as const,
      ownerId: owner.id,
      copy: curatedServices[index],
      index,
    })),
  ];
  return { packages, services, canvases };
}

export async function seedScenarioCatalog(
  db: SeedDb,
  input: {
    catalog: ReturnType<typeof planScenarioCatalog>;
    users: ScenarioUser[];
    now: Date;
  },
) {
  const admin = input.users.find((user) => user.role === "admin");
  if (!admin) throw new Error("Scenario catalog requires an administrator");
  let packages = 0,
    services = 0,
    media = 0,
    canvases = 0;
  const insertedOwners = new Set<string>();
  for (const [index, pkg] of input.catalog.packages.entries()) {
    const copy = curatedPackages[index];
    if (
      await insertIfNew(db, "packages", {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: copy.description,
        max_guests: pkg.maxGuests,
        price: pkg.price,
        published_at: input.now,
        archived_at: pkg.archived ? input.now : null,
        created_at: input.now,
        updated_at: input.now,
      })
    ) {
      packages++;
      insertedOwners.add(pkg.id);
    }
  }
  for (const [index, service] of input.catalog.services.entries()) {
    const copy = curatedServices[index];
    if (
      await insertIfNew(db, "services", {
        id: service.id,
        name: service.name,
        slug: catalogSlug(service.name),
        description: copy.description,
        hourly_rate_pesos: copy.rate,
        fixed_price_pesos: copy.fixed,
        included_hours: copy.hours,
        published_at: input.now,
        archived_at: service.archived ? input.now : null,
        created_at: input.now,
        updated_at: input.now,
      })
    ) {
      services++;
      insertedOwners.add(service.id);
    }
  }
  for (const page of input.catalog.canvases) {
    if (!insertedOwners.has(page.ownerId)) continue;
    const mediaId = scenarioId(`media:curated-catalog-v2:${page.key}`);
    if (
      await insertIfNew(db, "media_assets", {
        id: mediaId,
        kind: "image",
        source: "sample",
        url: page.copy.photo,
        storage_key: null,
        mime_type: null,
        byte_size: null,
        created_by: admin.id,
        created_at: input.now,
      })
    )
      media++;
    const link =
      page.kind === "package" && page.index < 3
        ? {
            kind: "service" as const,
            id: input.catalog.services[page.index].id,
            caption:
              "Explore this separately priced service as an optional idea; it is not included in this package.",
          }
        : page.kind === "service" && page.index === 0
          ? {
              kind: "package" as const,
              id: input.catalog.packages[0].id,
              caption:
                "Explore this related package; this link does not include the service or establish availability.",
            }
          : undefined;
    const content = buildCatalogCanvas(
      page.copy,
      mediaId,
      (part) => scenarioId(`${page.key}:${part}`),
      page.index,
      link,
    );
    await db
      .updateTable(page.kind === "package" ? "packages" : "services")
      .set({
        canvas: sql`${JSON.stringify(content)}::jsonb`,
        thumbnail_media_id: mediaId,
      })
      .where("id", "=", page.ownerId)
      .execute();
    canvases++;
  }
  for (let index = 0; index < 20; index++) {
    if (
      await insertIfNew(db, "media_assets", {
        id: scenarioId(`media:extra:${index}`),
        kind: "image",
        source: "sample",
        url: SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length],
        storage_key: null,
        mime_type: null,
        byte_size: null,
        created_by: admin.id,
        created_at: input.now,
      })
    )
      media++;
  }
  // Existing scenario rows are intentionally left untouched. Plan dependent
  // bookings from their stored state, in the same stable order as the plan.
  const packageRows = await db
    .selectFrom("packages")
    .select([
      "id",
      "name",
      "slug",
      "price",
      "max_guests",
      "archived_at",
      "published_at",
      "package_type",
    ])
    .where(
      "id",
      "in",
      input.catalog.packages.map((item) => item.id),
    )
    .execute();
  const serviceRows = await db
    .selectFrom("services")
    .select(["id", "name", "hourly_rate_pesos", "archived_at"])
    .where(
      "id",
      "in",
      input.catalog.services.map((item) => item.id),
    )
    .execute();
  const packageById = new Map(packageRows.map((row) => [row.id, row]));
  const serviceById = new Map(serviceRows.map((row) => [row.id, row]));
  const persistedPackages: ScenarioPackage[] = [];
  for (const item of input.catalog.packages) {
    const row = packageById.get(item.id);
    if (!row || row.package_type !== "catalog" || row.published_at === null)
      continue;
    persistedPackages.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      price: row.price,
      maxGuests: row.max_guests,
      archived: row.archived_at !== null,
    });
  }
  const persistedServices: ScenarioService[] = [];
  for (const item of input.catalog.services) {
    const row = serviceById.get(item.id);
    if (!row) continue;
    persistedServices.push({
      id: row.id,
      name: row.name,
      hourlyRatePesos: row.hourly_rate_pesos,
      archived: row.archived_at !== null,
    });
  }
  return {
    packages: persistedPackages,
    services: persistedServices,
    inserted: { packages, services, media, canvases },
  };
}
