import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;
export function listAdminVenuesData(db: Database) { return db.selectFrom("venues").selectAll().orderBy("created_at", "desc").orderBy("id").execute(); }
export function listPublicVenuesData(db: Database, limit?: number, offset = 0) { let query = db.selectFrom("venues").selectAll().where("archived_at", "is", null).orderBy("name").orderBy("id"); if (limit !== undefined) query = query.limit(limit).offset(offset); return query.execute(); }
export function findPublishedVenueData(db: Database, id: string) { return db.selectFrom("venues").selectAll().where("id", "=", id).where("archived_at", "is", null).executeTakeFirst(); }
