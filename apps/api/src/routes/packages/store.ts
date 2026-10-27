import { type Kysely, type Selectable, type Transaction } from "kysely";
import type { DB, PackageVersions, Packages } from "../../db/types.js";
import type { Content } from "./schemas.js";

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
export function publicDto(row: Version) {
  const v = versionDto(row);
  return { id: v.packageId, versionId: v.id, version: v.version, name: v.name, eventTypes: v.eventTypes,
    description: v.description, guestMin: v.guestMin, guestMax: v.guestMax, venueDetails: v.venueDetails,
    inclusions: v.inclusions, exclusions: v.exclusions, terms: v.terms, imageUrl: v.imageUrl,
    price: v.price, publishedAt: v.publishedAt! };
}
export function columns(content: Content) {
  return { name: content.name.trim(), event_types: content.eventTypes.map(x => x.trim()),
    description: content.description.trim(), guest_min: content.guestMin, guest_max: content.guestMax,
    venue_details: content.venueDetails.trim(), inclusions: [...new Set(content.inclusions.map(x => x.trim()).filter(Boolean))],
    exclusions: content.exclusions.map(x => x.trim()), terms: content.terms.trim(), image_url: imageId(content.imageUrl) ? content.imageUrl!.toLowerCase() : content.imageUrl,
    price_amount_minor: content.price?.amountMinor ?? null };
}
export function imageId(url: string | null) {
  return url?.match(/^\/v1\/package-images\/([0-9a-f-]+)$/i)?.[1]?.toLowerCase() ?? null;
}
export async function lockImages(db: Transaction<DB>, urls: (string | null)[]) {
  const ids = [...new Set(urls.map(imageId).filter((id): id is string => id !== null))].sort();
  for (const id of ids) await db.selectFrom("package_images").select("id").where("id", "=", id).forUpdate().executeTakeFirst();
}
export async function imageExists(db: Transaction<DB>, url: string | null) {
  const id = imageId(url);
  return !id || !!await db.selectFrom("package_images").select("id").where("id", "=", id).executeTakeFirst();
}
export async function removeUnusedImage(db: Transaction<DB>, url: string | null) {
  const id = imageId(url);
  if (!id) return false;
  const referenced = await db.selectFrom("package_versions").select("id").where("image_url", "=", `/v1/package-images/${id}`).executeTakeFirst();
  if (referenced) return false;
  await db.deleteFrom("package_images").where("id", "=", id).execute();
  return true;
}
export async function adminDto(db: Database, pkg: Package) {
  const rows = await db.selectFrom("package_versions").selectAll().where("package_id", "=", pkg.id).orderBy("version", "desc").execute();
  const versions = rows.map(versionDto);
  return { id: pkg.id, archivedAt: pkg.archived_at?.toISOString() ?? null,
    draft: versions.find(x => x.state === "draft") ?? null,
    published: versions.find(x => x.state === "published") ?? null, versions };
}
export async function lockPackage(db: Transaction<DB>, id: string) {
  return db.selectFrom("packages").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
}
export function nextUpdate(previous: Date) {
  return new Date(Math.max(Date.now(), previous.getTime() + 1));
}
export async function publicRows(db: Database, id?: string) {
  let q = db.selectFrom("package_versions as v").innerJoin("packages as p", "p.id", "v.package_id")
    .selectAll("v").where("v.state", "=", "published").where("p.archived_at", "is", null);
  if (id) q = q.where("p.id", "=", id);
  return q.orderBy("v.published_at", "desc").execute();
}
export function complete(row: Version) {
  return !!(row.name.trim() && row.description.trim() && row.venue_details.trim() && row.terms.trim()
    && row.event_types.length && row.event_types.every(x => x.trim())
    && row.inclusions.length && row.inclusions.every(x => x.trim())
    && row.exclusions.every(x => x.trim()) && row.price_amount_minor !== null);
}
