import { storedSectionsSchema } from "@event-management/contracts/catalog-canvas";
import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { sql } from "kysely";
import type { SeedDb } from "../context.js";
import {
  expectCount,
  insertIfNew,
  SCENARIO_COUNT,
  scenarioId,
  scenarioIndex,
} from "../context.js";
import type { ScenarioUser } from "./users.js";

const SAMPLE_PHOTOS = [
  "/images/wedding.jpg",
  "/images/dinner.jpg",
  "/images/dessert.jpg",
  "/images/hero.jpg",
] as const;

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

type WidgetKind = "photo" | "markdown" | "video";
type CanvasPlan = {
  key: string;
  owner: { packageId?: string; serviceId?: string };
  widget: WidgetKind;
  title: string;
  label: string;
};

function packagePrice(index: number) {
  return 15_000 + (index % 40) * 4_500;
}
function guestLimit(index: number) {
  return 30 + (index % 17) * 10;
}
function hourlyRate(index: number) {
  return 800 + (index % 25) * 150;
}

export function planScenarioCatalog(): ScenarioCatalog & {
  canvases: CanvasPlan[];
} {
  const packages = Array.from(
    { length: SCENARIO_COUNT },
    (_, index): ScenarioPackage => {
      const name = `Scenario Celebration ${scenarioIndex(index)}`;
      return {
        id: scenarioId(`package:${index}`),
        name,
        slug: catalogSlug(name),
        price: packagePrice(index),
        maxGuests: guestLimit(index),
        archived: index % 5 === 0,
      };
    },
  );
  const services = Array.from(
    { length: SCENARIO_COUNT },
    (_, index): ScenarioService => ({
      id: scenarioId(`service:${index}`),
      name: `Scenario Service ${scenarioIndex(index)}`,
      hourlyRatePesos: index >= 80 ? null : hourlyRate(index),
      archived: index >= 60,
    }),
  );
  const canvases: CanvasPlan[] = [
    ...services
      .filter((_, index) => index < 60)
      .map((service, index) => ({
        key: `service:${index}`,
        owner: { serviceId: service.id },
        widget: "photo" as const,
        title: index % 3 === 0 ? "" : "Details",
        label: service.name,
      })),
    ...packages
      .filter((_, index) => index < 20)
      .map((pkg, index) => ({
        key: `package:${index}`,
        owner: { packageId: pkg.id },
        widget: "markdown" as const,
        title: index % 2 === 0 ? "" : "Overview",
        label: pkg.name,
      })),
  ];
  expectCount("packages", packages.length);
  expectCount("services", services.length);
  expectCount("catalog canvases", canvases.length, 80);
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

  for (const pkg of input.catalog.packages) {
    if (
      await insertIfNew(db, "packages", {
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: `${pkg.name} is synthetic demonstration copy. Availability has not been checked.`,
        max_guests: pkg.maxGuests,
        price: pkg.price,
        published_at: input.now,
        archived_at: pkg.archived ? input.now : null,
        created_at: input.now,
        updated_at: input.now,
      })
    ) {
      packages += 1;
      insertedOwners.add(pkg.id);
    }
  }
  for (const service of input.catalog.services) {
    if (
      await insertIfNew(db, "services", {
        id: service.id,
        name: service.name,
        slug: catalogSlug(service.name),
        description: `${service.name} is a synthetic service. Availability has not been checked.`,
        hourly_rate_pesos: service.hourlyRatePesos,
        published_at: input.now,
        archived_at: service.archived ? input.now : null,
        created_at: input.now,
        updated_at: input.now,
      })
    ) {
      services += 1;
      insertedOwners.add(service.id);
    }
  }

  const attachedMedia = new Map<string, string>();
  for (const [index, page] of input.catalog.canvases.entries()) {
    if (page.widget === "markdown") continue;
    const id = scenarioId(`media:${page.key}`);
    attachedMedia.set(page.key, id);
    if (!insertedOwners.has(page.owner.packageId ?? page.owner.serviceId ?? ""))
      continue;
    const sample = page.widget === "photo";
    if (
      await insertIfNew(db, "media_assets", {
        id,
        kind: sample ? "image" : "video",
        source: sample ? "sample" : "upload",
        url: sample
          ? (SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length] ?? SAMPLE_PHOTOS[0])
          : null,
        storage_key: sample ? null : `catalog-media/${id}`,
        mime_type: sample ? null : "video/mp4",
        byte_size: sample ? null : 8_388_608,
        created_by: index % 2 === 0 ? admin.id : null,
        created_at: input.now,
      })
    )
      media += 1;
  }
  for (let index = 0; index < 20; index += 1) {
    const id = scenarioId(`media:extra:${index}`);
    if (
      await insertIfNew(db, "media_assets", {
        id,
        kind: "image",
        source: "sample",
        url: SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length] ?? SAMPLE_PHOTOS[0],
        storage_key: null,
        mime_type: null,
        byte_size: null,
        created_by: admin.id,
        created_at: input.now,
      })
    )
      media += 1;
  }
  expectCount("media", attachedMedia.size + 20, 80);

  for (const canvas of input.catalog.canvases) {
    const ownerId = canvas.owner.packageId ?? canvas.owner.serviceId;
    if (!ownerId || !insertedOwners.has(ownerId)) continue;
    const content = [
      {
        id: scenarioId(`section:${canvas.key}`),
        title: canvas.title,
        widgets: [
          {
            id: scenarioId(`widget:${canvas.key}`),
            type: canvas.widget,
            x: 0,
            y: 0,
            w: canvas.widget === "markdown" ? 12 : 6,
            h: canvas.widget === "markdown" ? 4 : 6,
            markdown:
              canvas.widget === "markdown"
                ? `## ${canvas.label}\n\nSynthetic demonstration copy. Availability has not been checked.`
                : "",
            mediaId: attachedMedia.get(canvas.key) ?? null,
            alt:
              canvas.widget === "markdown"
                ? ""
                : `Sample media for ${canvas.label}`,
            caption: "",
            autoplay: canvas.widget === "video" && canvas.key.endsWith("0"),
          },
        ],
      },
    ];
    await db
      .updateTable(canvas.owner.packageId ? "packages" : "services")
      .set({
        canvas: sql`${JSON.stringify(storedSectionsSchema.parse(content))}::jsonb`,
      })
      .where("id", "=", ownerId)
      .execute();
    canvases += 1;
  }

  return {
    packages: input.catalog.packages,
    services: input.catalog.services,
    inserted: { packages, services, media, canvases },
  };
}
