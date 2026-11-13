import { InvalidPackageMedia, listCatalogMediaIdsData, replaceCatalogSectionsData } from "../../data/packages/catalog-page.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { VenueContent } from "../../controllers/venues/schemas.js";
import { createVenueData } from "../../data/venues/create-venue.js";
import { findVenueData, lockVenueData } from "../../data/venues/find-venue.js";
import { findPublishedVenueData, findPublishedVenueBySlugData } from "../../data/venues/list-venues.js";
import { updateVenueData } from "../../data/venues/update-venue.js";
import { archiveVenueData } from "../../data/venues/archive-venue.js";
import { deleteVenueData } from "../../data/venues/delete-venue.js";
import { venueAdminDto, venuePublicDto } from "./venue-response.js";
import { error, nextUpdate } from "./venue-rules.js";
import { duplicateTitle, reserveCatalogTitle } from "../../utils/catalog-title.js";
export async function getVenueService(db: Kysely<DB>, id: string) { const row = await findPublishedVenueData(db, id); return row ? venuePublicDto(db, row) : error("Venue not found", 404); }
export async function getVenueBySlugService(db: Kysely<DB>, slug: string) { const row = await findPublishedVenueBySlugData(db, slug); return row ? venuePublicDto(db, row) : error("Venue not found", 404); }
export async function getAdminVenueService(db: Kysely<DB>, id: string) { const row = await findVenueData(db, id); return row ? venueAdminDto(db, row) : error("Venue not found", 404); }
export async function createVenueService(db: Kysely<DB>, input: VenueContent, actorId: string) {
 try { return await db.transaction().execute(async trx => {
  const title = await reserveCatalogTitle(trx, "venues", input.name);
  if (!title) return error("A venue with this title already exists", 409);
  const row = await createVenueData(trx, input, title.slug);
  await replaceCatalogSectionsData(trx, { kind: "venue", id: row.id }, { sections: input.sections ?? [] }, actorId, new Date());
  return venueAdminDto(trx, row);
 }); } catch (cause) {
  const duplicate = duplicateTitle(cause, "A venue with this title already exists");
  if (duplicate) return duplicate;
  if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
  throw cause;
 }
}
export async function updateVenueService(db: Kysely<DB>, id: string, input: VenueContent & { expectedUpdatedAt: string }, actorId: string) {
 try { let previousMedia: string[] = [];
 const outcome = await db.transaction().execute(async trx => {
  const current = await lockVenueData(trx, id); if (!current) return error("Venue not found", 404);
  if (current.archived_at) return error("Archived venues cannot be edited", 409);
  if (current.updated_at.toISOString() !== input.expectedUpdatedAt) return error("Venue changed. Refresh and try again", 409);
  const title = await reserveCatalogTitle(trx, "venues", input.name, id);
  if (!title) return error("A venue with this title already exists", 409);
  const now = nextUpdate(current.updated_at); const row = await updateVenueData(trx, id, input, title.slug, now);
  if (input.sections !== undefined) previousMedia = await replaceCatalogSectionsData(trx, { kind: "venue", id }, { sections: input.sections }, actorId, now);
  return venueAdminDto(trx, row);
 });
 if (!("status" in outcome)) await cleanupCatalogMediaService(db, previousMedia); return outcome;
 } catch (cause) {
  const duplicate = duplicateTitle(cause, "A venue with this title already exists");
  if (duplicate) return duplicate;
  if (cause instanceof InvalidPackageMedia) return error(cause.message, 400);
  throw cause;
 }
}
export async function archiveVenueService(db: Kysely<DB>, id: string) {
 return db.transaction().execute(async trx => { const row = await lockVenueData(trx, id); if (!row) return error("Venue not found", 404); const updated = await archiveVenueData(trx, id, row.archived_at ?? new Date(), nextUpdate(row.updated_at)); return venueAdminDto(trx, updated); });
}
export async function deleteVenueService(db: Kysely<DB>, id: string) {
 let media: string[] = [];
 const outcome = await db.transaction().execute(async trx => { const row = await lockVenueData(trx, id); if (!row) return error("Venue not found", 404); media = await listCatalogMediaIdsData(trx, { kind: "venue", id }); await deleteVenueData(trx, id); return null; });
 if (!outcome) await cleanupCatalogMediaService(db, media); return outcome;
}
