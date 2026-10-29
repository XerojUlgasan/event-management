import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { createVenueData } from "../../data/venues/create-venue.js";
import { findVenueData } from "../../data/venues/find-venue.js";
import { listVenuesData } from "../../data/venues/list-venues.js";
import { updateVenueData } from "../../data/venues/update-venue.js";
import { archiveVenueData } from "../../data/venues/archive-venue.js";
import { venueDto } from "./venue-response.js";
import { error } from "./venue-rules.js";

export async function listVenuesService(db: Kysely<DB>) {
  const rows = await listVenuesData(db);
  return { venues: rows.map(venueDto) };
}

export async function createVenueService(db: Kysely<DB>, name: string, location: string, description: string) {
  return db.transaction().execute(async trx => {
    const row = await createVenueData(trx, name.trim(), location.trim(), description.trim());
    return venueDto(row);
  });
}

export async function updateVenueService(db: Kysely<DB>, id: string, name: string, location: string, description: string) {
  return db.transaction().execute(async trx => {
    const existing = await findVenueData(trx, id);
    if (!existing) return error("Venue not found", 404);
    if (existing.archived_at) return error("Venue is archived", 409);
    const row = await updateVenueData(trx, id, name.trim(), location.trim(), description.trim());
    if (!row) return error("Venue not found", 404);
    return venueDto(row);
  });
}

export async function archiveVenueService(db: Kysely<DB>, id: string) {
  return db.transaction().execute(async trx => {
    const existing = await findVenueData(trx, id);
    if (!existing) return error("Venue not found", 404);
    if (existing.archived_at) return error("Venue is already archived", 409);
    const row = await archiveVenueData(trx, id);
    if (!row) return error("Venue not found", 404);
    return venueDto(row);
  });
}
