import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { VenueContent } from "../../controllers/venues/schemas.js";
import { createVenueData } from "../../data/venues/create-venue.js";
import { findVenueData, lockVenueData } from "../../data/venues/find-venue.js";
import { listAdminVenuesData, listPublicVenuesData, findPublishedVenueData, listVenueVersionsData } from "../../data/venues/list-venues.js";
import { createVenueDraftData, updateVenueDraftData, publishVenueDraftData } from "../../data/venues/write-venue-version.js";
import { touchVenueData } from "../../data/venues/update-venue.js";
import { archiveVenueData } from "../../data/venues/archive-venue.js";
import { deleteVenueData } from "../../data/venues/delete-venue.js";
import { venuePhotosData, venueImageUrl, venueImageId, lockVenueImagesData, checkVenueImagesData, replaceVenuePhotosData, deleteUnusedVenueImageData } from "../../data/venues/venue-images.js";
import { venueAdminDto, venuePublicDto } from "./venue-response.js";
import { error, nextUpdate } from "./venue-rules.js";
const validCapacity = (input: VenueContent) => input.capacityMin === null || input.capacityMax === null || input.capacityMin <= input.capacityMax;
export async function listVenuesService(db: Kysely<DB>, limit?: number, offset = 0) { const rows = await listPublicVenuesData(db, limit === undefined ? undefined : limit + 1, offset); return { venues: await Promise.all((limit === undefined ? rows : rows.slice(0, limit)).map(v => venuePublicDto(db, v))), nextOffset: limit !== undefined && rows.length > limit ? offset + limit : null }; }
export async function listAdminVenuesService(db: Kysely<DB>) { return { venues: await Promise.all((await listAdminVenuesData(db)).map(v => venueAdminDto(db, v))) }; }
export async function getVenueService(db: Kysely<DB>, id: string) { const row = await findPublishedVenueData(db, id); return row ? venuePublicDto(db, row) : error("Venue not found", 404); }
export async function getAdminVenueService(db: Kysely<DB>, id: string) { const venue = await findVenueData(db, id); return venue ? venueAdminDto(db, venue) : error("Venue not found", 404); }
export async function createVenueService(db: Kysely<DB>, input: VenueContent) {
 if (!validCapacity(input)) return error("Minimum capacity must not exceed maximum capacity", 400);
 return db.transaction().execute(async trx => {
  await lockVenueImagesData(trx, input.imageUrls);
  if (!await checkVenueImagesData(trx, input.imageUrls)) return error("Uploaded venue photo not found", 400);
  const venue = await createVenueData(trx); const draft = await createVenueDraftData(trx, venue.id, 1, input);
  await replaceVenuePhotosData(trx, draft.id, input.imageUrls);
  return venueAdminDto(trx, venue);
 });
}
export async function updateVenueService(db: Kysely<DB>, id: string, input: VenueContent & { expectedUpdatedAt: string }) {
 if (!validCapacity(input)) return error("Minimum capacity must not exceed maximum capacity", 400);
 return db.transaction().execute(async trx => {
  const venue = await lockVenueData(trx, id); if (!venue) return error("Venue not found", 404);
  if (venue.archived_at) return error("Archived venues cannot be edited", 409);
  const current = (await listVenueVersionsData(trx, id))[0];
  if (!current || current.updated_at.toISOString() !== input.expectedUpdatedAt) return error("Venue changed. Refresh and try again", 409);
  const previousUrls = (await venuePhotosData(trx, current.id)).map(p => venueImageUrl(p.image_id));
  await lockVenueImagesData(trx, [...previousUrls, ...input.imageUrls]);
  if (!await checkVenueImagesData(trx, input.imageUrls)) return error("Uploaded venue photo not found", 400);
  const now = nextUpdate(current.updated_at);
  let draftId = current.id;
  if (current.state === "draft") await updateVenueDraftData(trx, current.id, input, now);
  else draftId = (await createVenueDraftData(trx, id, current.version + 1, input, now)).id;
  await replaceVenuePhotosData(trx, draftId, input.imageUrls);
  if (current.state === "draft") for (const url of previousUrls) await deleteUnusedVenueImageData(trx, venueImageId(url));
  await touchVenueData(trx, id, now); return venueAdminDto(trx, venue);
 });
}
export async function publishVenueService(db: Kysely<DB>, id: string, expected: string) {
 return db.transaction().execute(async trx => {
  const venue = await lockVenueData(trx, id); if (!venue) return error("Venue not found", 404);
  if (venue.archived_at) return error("Archived venues cannot be published", 409);
  const draft = (await listVenueVersionsData(trx, id)).find(v => v.state === "draft");
  if (!draft) return error("No draft to publish", 409);
  if (draft.updated_at.toISOString() !== expected) return error("Venue changed. Refresh and try again", 409);
  if (![draft.name, draft.location, draft.description].every(v => v.trim()) || draft.capacity_min === null || draft.capacity_max === null || !(await venuePhotosData(trx, draft.id)).length) return error("Complete title, location, description, capacity and at least one photo before publishing", 400);
  const now = nextUpdate(draft.updated_at); await publishVenueDraftData(trx, id, draft.id, now); await touchVenueData(trx, id, now);
  return venueAdminDto(trx, venue);
 });
}
export async function archiveVenueService(db: Kysely<DB>, id: string) {
 return db.transaction().execute(async trx => { const venue = await lockVenueData(trx, id); if (!venue) return error("Venue not found", 404); const updated = venue.archived_at ? venue : await archiveVenueData(trx, id, new Date()); return venueAdminDto(trx, updated); });
}
export async function deleteVenueService(db: Kysely<DB>, id: string) {
 return db.transaction().execute(async trx => {
  const venue = await lockVenueData(trx, id); if (!venue) return error("Venue not found", 404);
  const versions = await listVenueVersionsData(trx, id);
  if (versions.some(v => v.published_at !== null)) return error("Published venues cannot be deleted; archive instead", 409);
  const urls = (await Promise.all(versions.map(v => venuePhotosData(trx, v.id)))).flat().map(p => venueImageUrl(p.image_id));
  await lockVenueImagesData(trx, urls); await deleteVenueData(trx, id);
  for (const url of urls) await deleteUnusedVenueImageData(trx, venueImageId(url)); return null;
 });
}
