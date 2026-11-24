import type { EventType } from "@event-management/contracts/catalog-filters";
import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { sql } from "kysely";
import { seedAssetUpload } from "../asset-upload.js";
import { expectCount, scenarioId, type SeedDb } from "../context.js";
import { buildCatalogCanvas, type CatalogCopy } from "../curated-catalog.js";
import { curatedPackages } from "../package-collection.js";
import { curatedServices } from "../service-collection.js";
import type { ScenarioUser } from "./users.js";

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

const COLLECTION_SIZE = 10;
const LEGACY_PACKAGE_COUNT = 20;

const packageEventTypes: Readonly<Partial<Record<string, EventType>>> = {
  "Civil Wedding Family Table": "Wedding",
  "Garden Wedding Under the Lights": "Wedding",
  "Eighteen in the Spotlight": "Debut",
  "Birthday Playroom Party": "Birthday",
  "Team Workshop and Breakouts": "Corporate",
  "Recognition Night and Awards": "Corporate",
  "First Look Product Launch": "Corporate",
};

const relatedServices: Readonly<Record<string, string>> = {
  "Reception Grazing Table": "Mini Dessert Station",
  "Mini Dessert Station": "Espresso Coffee Cart",
  "Reception Emcee": "Speech and PA Support",
  "Reception Table Florals": "Floral Portrait Backdrop",
};

export function catalogPhotoId(pageKey: string, file: string) {
  return scenarioId(`media:seed-catalog:${pageKey}:${file}`);
}

export function planScenarioCatalog() {
  expectCount("catalog packages", curatedPackages.length, COLLECTION_SIZE);
  expectCount("catalog services", curatedServices.length, COLLECTION_SIZE);

  const packages = curatedPackages.map((copy, index) => ({
    id: scenarioId(`package:${index}`),
    name: copy.name,
    slug: catalogSlug(copy.name),
    price: copy.price,
    maxGuests: copy.guests,
  }));

  const services = curatedServices.map((copy, index) => ({
    id: scenarioId(`service:${index}`),
    name: copy.name,
    hourlyRatePesos: copy.rate,
  }));

  const canvases = [
    ...packages.map((owner, index) => ({
      key: `package:${index}`,
      kind: "package" as const,
      ownerId: owner.id,
      copy: curatedPackages[index] satisfies CatalogCopy,
      index,
    })),
    ...services.map((owner, index) => ({
      key: `service:${index}`,
      kind: "service" as const,
      ownerId: owner.id,
      copy: curatedServices[index] satisfies CatalogCopy,
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

  let packages = 0;
  let services = 0;
  let media = 0;
  let canvases = 0;
  const insertedOwners = new Set<string>();

  for (const [index, pkg] of input.catalog.packages.entries()) {
    const { description } = curatedPackages[index];

    const row = await db
      .insertInto("packages")
      .values({
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description,
        max_guests: pkg.maxGuests,
        price: pkg.price,
        event_type: packageEventTypes[pkg.name] ?? null,
        published_at: input.now,
        created_at: input.now,
        updated_at: input.now,
      })
      .onConflict((conflict) => conflict.doNothing())
      .returning("id")
      .executeTakeFirst();

    if (row) {
      packages++;
      insertedOwners.add(row.id);
    }
  }

  for (const [index, service] of input.catalog.services.entries()) {
    const copy = curatedServices[index];

    const row = await db
      .insertInto("services")
      .values({
        id: service.id,
        name: service.name,
        slug: catalogSlug(service.name),
        description: copy.description,
        hourly_rate_pesos: copy.rate,
        fixed_price_pesos: copy.fixed,
        included_hours: copy.hours,
        published_at: input.now,
        created_at: input.now,
        updated_at: input.now,
      })
      .onConflict((conflict) => conflict.doNothing())
      .returning("id")
      .executeTakeFirst();

    if (row) {
      services++;
      insertedOwners.add(row.id);
    }
  }

  const serviceRows = await db
    .selectFrom("services")
    .select(["id", "name", "hourly_rate_pesos", "archived_at", "published_at"])
    .where(
      "id",
      "in",
      input.catalog.services.map((item) => item.id),
    )
    .execute();

  const activeServicesByName = new Map(
    serviceRows
      .filter((item) => item.published_at !== null && item.archived_at === null)
      .map((item) => [item.name, item.id]),
  );

  for (const page of input.catalog.canvases) {
    if (!insertedOwners.has(page.ownerId)) continue;

    const { images } = page.copy;

    if (
      images.length < 3 ||
      new Set(images.map(({ file }) => file)).size !== images.length ||
      images.some(({ alt }) => !alt.trim())
    )
      throw new Error(
        `Seed listing needs at least three distinct photos with alt text: ${page.copy.name}`,
      );

    const mediaIds = images.map(({ file }) => catalogPhotoId(page.key, file));

    const content = buildCatalogCanvas(
      page.copy,
      mediaIds,
      (part) => scenarioId(`${page.key}:${part}`),
      {
        index: page.index,
        title: page.kind === "package" ? "The concept" : "Service overview",
        relatedServiceId:
          page.kind === "service"
            ? activeServicesByName.get(relatedServices[page.copy.name])
            : undefined,
      },
    );

    for (const [index, { file }] of images.entries()) {
      await seedAssetUpload(
        db,
        {
          file,
          id: mediaIds[index],
          createdBy: admin.id,
        },
        { kind: page.kind, id: page.ownerId },
      );
      media++;
    }

    await db
      .updateTable(page.kind === "package" ? "packages" : "services")
      .set({
        canvas: sql`${JSON.stringify(content)}::jsonb`,
        thumbnail_media_id: mediaIds[0],
      })
      .where("id", "=", page.ownerId)
      .execute();
    canvases++;
  }

  // Earlier seed databases can still have additional published listings.
  // Keep those available for missing scenario bookings without recreating them.
  const packageOrder = [
    ...input.catalog.packages.map((item) => item.id),
    ...Array.from(
      { length: LEGACY_PACKAGE_COUNT - COLLECTION_SIZE },
      (_, index) => scenarioId(`package:${COLLECTION_SIZE + index}`),
    ),
  ];

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
    .where("id", "in", packageOrder)
    .execute();

  const packageById = new Map(packageRows.map((row) => [row.id, row]));

  const serviceById = new Map(serviceRows.map((row) => [row.id, row]));

  const persistedPackages: ScenarioPackage[] = [];

  for (const id of packageOrder) {
    const row = packageById.get(id);

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
