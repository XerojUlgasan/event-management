import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export function listAdminVenuesData(db: Database) { return db.selectFrom("venues").selectAll().orderBy("created_at", "desc").orderBy("id").execute(); }
export function listPublicVenuesData(db: Database, limit?: number, offset = 0) {
  let query = db.selectFrom("venue_versions as v").innerJoin("venues as venue", "venue.id", "v.venue_id").selectAll("v").select(["venue.created_at as venue_created_at", "venue.updated_at as venue_updated_at"]).where("v.state", "=", "published").where("venue.archived_at", "is", null).orderBy("v.name").orderBy("v.venue_id");
  if (limit !== undefined) query = query.limit(limit).offset(offset);
  return query.execute();
}
export function findPublishedVenueData(db: Database, id: string) { return db.selectFrom("venue_versions as v").innerJoin("venues as venue", "venue.id", "v.venue_id").selectAll("v").select(["venue.created_at as venue_created_at", "venue.updated_at as venue_updated_at"]).where("v.venue_id", "=", id).where("v.state", "=", "published").where("venue.archived_at", "is", null).executeTakeFirst(); }
export function listVenueVersionsData(db: Database, id: string) { return db.selectFrom("venue_versions").selectAll().where("venue_id", "=", id).orderBy("version", "desc").execute(); }
