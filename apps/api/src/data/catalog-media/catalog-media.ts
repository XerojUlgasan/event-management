import { sql, type Kysely, type Transaction } from "kysely";
import type { DB, MediaAssets } from "../../db/types.js";
import type { Insertable } from "kysely";
type Database = Kysely<DB> | Transaction<DB>;
export const createCatalogMediaData = (db: Database, values: Insertable<MediaAssets>) => db.insertInto("media_assets").values(values).returningAll().executeTakeFirstOrThrow();
export const lockCatalogMediaData = (db: Transaction<DB>, id: string) => db.selectFrom("media_assets").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
export const catalogMediaReferencedData = (db: Database, id: string) => db.selectFrom("media_assets as m").select("m.id").where("m.id", "=", id).where(sql<boolean>`(EXISTS (SELECT 1 FROM catalog_widgets w WHERE w.media_id=m.id) OR EXISTS (SELECT 1 FROM quotations q WHERE jsonb_path_exists(q.offered_package_terms, '$.package.sections[*].widgets[*].media.id ? (@ == $id)', jsonb_build_object('id', m.id::text))))`).executeTakeFirst();
export const deleteCatalogMediaData = (db: Database, id: string) => db.deleteFrom("media_assets").where("id", "=", id).execute();
export const findAdminCatalogMediaData = (db: Database, id: string, actorId: string) => db.selectFrom("media_assets as m").selectAll("m").where("m.id", "=", id).where("m.source", "=", "upload").where(eb => eb.or([eb("m.created_by", "=", actorId), sql<boolean>`EXISTS (SELECT 1 FROM catalog_widgets w WHERE w.media_id=m.id) OR EXISTS (SELECT 1 FROM quotations q WHERE jsonb_path_exists(q.offered_package_terms, '$.package.sections[*].widgets[*].media.id ? (@ == $id)', jsonb_build_object('id', m.id::text)))`])).executeTakeFirst();
export const staleCatalogMediaData = (db: Database, before: Date, limit: number) => db.selectFrom("media_assets as m").select("m.id").where("m.created_at", "<", before).where(sql<boolean>`NOT EXISTS (SELECT 1 FROM catalog_widgets w WHERE w.media_id=m.id) AND NOT EXISTS (SELECT 1 FROM quotations q WHERE jsonb_path_exists(q.offered_package_terms, '$.package.sections[*].widgets[*].media.id ? (@ == $id)', jsonb_build_object('id', m.id::text)))`).orderBy("m.created_at").orderBy("m.id").limit(limit).execute();
export const findPublicCatalogMediaData = (db: Database, id: string) => db.selectFrom("media_assets as m").selectAll("m").where("m.id", "=", id).where("m.source", "=", "upload").where(sql<boolean>`EXISTS (
  SELECT 1 FROM catalog_widgets w JOIN catalog_sections s ON s.id=w.section_id JOIN catalog_pages cp ON cp.id=s.page_id
  LEFT JOIN packages p ON p.id=cp.package_id LEFT JOIN venues v ON v.id=cp.venue_id LEFT JOIN services sv ON sv.id=cp.service_id
  WHERE w.media_id=m.id AND ((p.id IS NOT NULL AND p.package_type='catalog' AND p.published_at IS NOT NULL AND p.archived_at IS NULL)
    OR (v.id IS NOT NULL AND v.archived_at IS NULL)
    OR (sv.id IS NOT NULL AND sv.archived_at IS NULL))
)`).executeTakeFirst();

export const findCustomerCatalogMediaData = (db: Database, id: string, customerId: string) => db.selectFrom("media_assets as m").selectAll("m").where("m.id", "=", id).where("m.source", "=", "upload").where(sql<boolean>`(EXISTS (
 SELECT 1 FROM catalog_widgets w JOIN catalog_sections s ON s.id=w.section_id JOIN catalog_pages cp ON cp.id=s.page_id
 JOIN packages p ON p.id=cp.package_id JOIN booking_requests br ON br.id=p.custom_for_booking_request_id AND br.package_id=p.id
 WHERE w.media_id=m.id AND p.package_type='custom' AND br.customer_id=${customerId}::uuid
) OR EXISTS (SELECT 1 FROM quotations q JOIN booking_requests br ON br.id=q.booking_request_id WHERE br.customer_id=${customerId}::uuid AND jsonb_path_exists(q.offered_package_terms, '$.package.sections[*].widgets[*].media.id ? (@ == $id)', jsonb_build_object('id', m.id::text))))`).executeTakeFirst();
