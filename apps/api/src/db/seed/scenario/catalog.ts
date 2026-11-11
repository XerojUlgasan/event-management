import { catalogSlug } from "@event-management/contracts/catalog-slug";
import type { SeedDb } from "../context.js";
import { expectCount, insertIfNew, SCENARIO_COUNT, scenarioId, scenarioIndex } from "../context.js";
import type { ScenarioUser } from "./users.js";

const SAMPLE_PHOTOS = ["/images/wedding.jpg", "/images/dinner.jpg", "/images/dessert.jpg", "/images/hero.jpg"] as const;
const CITIES = ["Quezon City", "Makati", "Taguig", "Pasig", "Cebu City", "Davao City", "Baguio", "Iloilo City"] as const;

export type ScenarioPackage = {
  id: string;
  name: string;
  slug: string;
  price: number;
  maxGuests: number;
  archived: boolean;
};
export type ScenarioVenue = {
  id: string;
  name: string;
  location: string;
  maxGuests: number | null;
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
  venues: ScenarioVenue[];
  services: ScenarioService[];
};

type WidgetKind = "photo" | "markdown" | "video";
type PagePlan = {
  key: string;
  owner: { packageId?: string; venueId?: string; serviceId?: string };
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

export function planScenarioCatalog(): ScenarioCatalog & { pages: PagePlan[] } {
  const packages = Array.from({ length: SCENARIO_COUNT }, (_, index): ScenarioPackage => {
    const name = `Scenario Celebration ${scenarioIndex(index)}`;
    return {
      id: scenarioId(`package:${index}`),
      name,
      slug: catalogSlug(name),
      price: packagePrice(index),
      maxGuests: guestLimit(index),
      archived: index % 5 === 0,
    };
  });
  const venues = Array.from({ length: SCENARIO_COUNT }, (_, index): ScenarioVenue => {
    const name = `Scenario Venue ${scenarioIndex(index)}`;
    const legacy = index >= 90;
    return {
      id: scenarioId(`venue:${index}`),
      name,
      location: `${CITIES[index % CITIES.length] ?? "Quezon City"} sample ${scenarioIndex(index)}`,
      maxGuests: legacy ? null : guestLimit(index),
      archived: index >= 70,
    };
  });
  const services = Array.from({ length: SCENARIO_COUNT }, (_, index): ScenarioService => ({
    id: scenarioId(`service:${index}`),
    name: `Scenario Service ${scenarioIndex(index)}`,
    hourlyRatePesos: index >= 80 ? null : hourlyRate(index),
    archived: index >= 60,
  }));
  const pages: PagePlan[] = [
    ...services.filter((_, index) => index < 60).map((service, index) => ({
      key: `service:${index}`,
      owner: { serviceId: service.id },
      widget: "photo" as const,
      title: index % 3 === 0 ? "" : "Details",
      label: service.name,
    })),
    ...venues.filter((_, index) => index < 15).map((venue, index) => ({
      key: `venue-photo:${index}`,
      owner: { venueId: venue.id },
      widget: "photo" as const,
      title: "Space",
      label: venue.name,
    })),
    ...venues.filter((_, index) => index >= 70 && index < 75).map((venue, index) => ({
      key: `venue-video:${index + 70}`,
      owner: { venueId: venue.id },
      widget: "video" as const,
      title: "Walkthrough",
      label: venue.name,
    })),
    ...packages.filter((_, index) => index < 20).map((pkg, index) => ({
      key: `package:${index}`,
      owner: { packageId: pkg.id },
      widget: "markdown" as const,
      title: index % 2 === 0 ? "" : "Overview",
      label: pkg.name,
    })),
  ];
  expectCount("packages", packages.length);
  expectCount("venues", venues.length);
  expectCount("services", services.length);
  expectCount("catalog pages", pages.length);
  return { packages, venues, services, pages };
}

export async function seedScenarioCatalog(
  db: SeedDb,
  input: { catalog: ReturnType<typeof planScenarioCatalog>; users: ScenarioUser[]; now: Date },
) {
  const admin = input.users.find((user) => user.role === "admin");
  if (!admin) throw new Error("Scenario catalog requires an administrator");
  let packages = 0;
  let venues = 0;
  let services = 0;
  let media = 0;
  let pages = 0;
  let sections = 0;
  let widgets = 0;

  for (const pkg of input.catalog.packages) {
    if (await insertIfNew(db, "packages", {
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
    })) packages += 1;
  }
  for (const venue of input.catalog.venues) {
    if (await insertIfNew(db, "venues", {
      id: venue.id,
      name: venue.name,
      slug: catalogSlug(venue.name),
      location: venue.location,
      description: `${venue.name} is a synthetic venue. Availability has not been checked.`,
      max_guests: venue.maxGuests,
      published_at: input.now,
      archived_at: venue.archived ? input.now : null,
      created_at: input.now,
      updated_at: input.now,
    })) venues += 1;
  }
  for (const service of input.catalog.services) {
    if (await insertIfNew(db, "services", {
      id: service.id,
      name: service.name,
      slug: catalogSlug(service.name),
      description: `${service.name} is a synthetic service. Availability has not been checked.`,
      hourly_rate_pesos: service.hourlyRatePesos,
      published_at: input.now,
      archived_at: service.archived ? input.now : null,
      created_at: input.now,
      updated_at: input.now,
    })) services += 1;
  }

  const attachedMedia = new Map<string, string>();
  for (const [index, page] of input.catalog.pages.entries()) {
    if (page.widget === "markdown") continue;
    const id = scenarioId(`media:${page.key}`);
    attachedMedia.set(page.key, id);
    const sample = page.widget === "photo";
    if (await insertIfNew(db, "media_assets", {
      id,
      kind: sample ? "image" : "video",
      source: sample ? "sample" : "upload",
      url: sample ? SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length] ?? SAMPLE_PHOTOS[0] : null,
      storage_key: sample ? null : `catalog-media/${id}`,
      mime_type: sample ? null : "video/mp4",
      byte_size: sample ? null : 8_388_608,
      created_by: index % 2 === 0 ? admin.id : null,
      created_at: input.now,
    })) media += 1;
  }
  for (let index = 0; index < 20; index += 1) {
    const id = scenarioId(`media:extra:${index}`);
    if (await insertIfNew(db, "media_assets", {
      id,
      kind: "image",
      source: "sample",
      url: SAMPLE_PHOTOS[index % SAMPLE_PHOTOS.length] ?? SAMPLE_PHOTOS[0],
      storage_key: null,
      mime_type: null,
      byte_size: null,
      created_by: admin.id,
      created_at: input.now,
    })) media += 1;
  }
  expectCount("media", attachedMedia.size + 20);

  for (const page of input.catalog.pages) {
    const pageId = scenarioId(`page:${page.key}`);
    const sectionId = scenarioId(`section:${page.key}`);
    const widgetId = scenarioId(`widget:${page.key}`);
    const mediaId = attachedMedia.get(page.key) ?? null;
    if (await insertIfNew(db, "catalog_pages", {
      id: pageId,
      package_id: page.owner.packageId ?? null,
      venue_id: page.owner.venueId ?? null,
      service_id: page.owner.serviceId ?? null,
      created_at: input.now,
      updated_at: input.now,
    })) pages += 1;
    if (await insertIfNew(db, "catalog_sections", {
      id: sectionId,
      page_id: pageId,
      title: page.title,
      sort_order: 0,
    })) sections += 1;
    const video = page.widget === "video";
    if (await insertIfNew(db, "catalog_widgets", {
      id: widgetId,
      section_id: sectionId,
      type: page.widget,
      sort_order: 0,
      x: 0,
      y: 0,
      w: page.widget === "markdown" ? 12 : 6,
      h: page.widget === "markdown" ? 4 : 6,
      markdown: page.widget === "markdown" ? `## ${page.label}\n\nSynthetic demonstration copy. Availability has not been checked.` : "",
      media_id: mediaId,
      alt: page.widget === "markdown" ? "" : `Sample media for ${page.label}`,
      caption: "",
      autoplay: video && page.key.endsWith("0"),
    })) widgets += 1;
  }

  return {
    packages: input.catalog.packages,
    venues: input.catalog.venues,
    services: input.catalog.services,
    inserted: { packages, venues, services, media, pages, sections, widgets },
  };
}
