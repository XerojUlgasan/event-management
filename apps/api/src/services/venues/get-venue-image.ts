import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { hasAdminSessionService } from "../auth/has-admin-session.js";
import { findPublicVenueImageData, findVenueImageData } from "../../data/venues/venue-images.js";
export async function getVenueImageService(db: Kysely<DB>, id: string, token?: string) { if (!await findPublicVenueImageData(db,id) && !await hasAdminSessionService(db,token)) return null; return await findVenueImageData(db,id) ?? null; }
