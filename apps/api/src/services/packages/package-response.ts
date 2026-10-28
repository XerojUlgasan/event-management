import { assignmentsData } from "../../data/packages/service-assignments.js";
import type { Kysely, Selectable, Transaction } from "kysely";
import type { DB, PackageVersions, Packages } from "../../db/types.js";
import { listPackageVersionsData } from "../../data/packages/list-package-versions.js";

type Database = Kysely<DB> | Transaction<DB>;
type Version = Selectable<PackageVersions>;
type Package = Selectable<Packages>;

export function versionDto(row: Version) {
  return {
    id: row.id, packageId: row.package_id, version: row.version,
    state: row.state as "draft" | "published" | "superseded",
    name: row.name, eventTypes: row.event_types, description: row.description,
    guestMin: row.guest_min, guestMax: row.guest_max, venueDetails: row.venue_details,
    inclusions: row.inclusions, exclusions: row.exclusions, terms: row.terms, imageUrl: row.image_url,
    price: row.price_amount_minor !== null
      ? { kind: "fixed" as const, currency: "PHP" as const, amountMinor: row.price_amount_minor } : null,
    updatedAt: row.updated_at.toISOString(), publishedAt: row.published_at?.toISOString() ?? null,
  };
}

export async function publicDto(db: Database, row: Version) {
  const v = versionDto(row);
  return { services: await assignmentsData(db, row.id), id: v.packageId, versionId: v.id, version: v.version, name: v.name, eventTypes: v.eventTypes,
    description: v.description, guestMin: v.guestMin, guestMax: v.guestMax, venueDetails: v.venueDetails,
    inclusions: v.inclusions, exclusions: v.exclusions, terms: v.terms, imageUrl: v.imageUrl,
    price: v.price, publishedAt: v.publishedAt! };
}

export async function adminDto(db: Database, pkg: Package) {
  const versions = await Promise.all((await listPackageVersionsData(db, pkg.id)).map(async row => ({ ...versionDto(row), services: await assignmentsData(db, row.id) })));
  return { id: pkg.id, archivedAt: pkg.archived_at?.toISOString() ?? null,
    draft: versions.find(x => x.state === "draft") ?? null,
    published: versions.find(x => x.state === "published") ?? null, versions };
}

