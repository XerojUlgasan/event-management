import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

/**
 * Returns a media_assets row only when it is referenced by at least one
 * published showcase record (as its cover or a gallery asset).
 * This enforces BR-06: unpublished-record media is not publicly accessible.
 */
export const findPublicShowcaseMediaData = (db: Database, id: string) =>
  db
    .selectFrom("media_assets as m")
    .selectAll("m")
    .where("m.id", "=", id)
    .where((eb) =>
      eb.or([
        // Referenced as cover of a published record.
        eb.exists(
          eb
            .selectFrom("showcase_records as sr")
            .select("sr.id")
            .where("sr.published_at", "is not", null)
            .where("sr.cover_media_id", "=", eb.ref("m.id")),
        ),
        // Referenced in gallery of a published record.
        eb.exists(
          eb
            .selectFrom("showcase_records as sr")
            .select("sr.id")
            .where("sr.published_at", "is not", null)
            .whereRef("sr.id", "=", "m.showcase_record_id"),
        ),
      ]),
    )
    .executeTakeFirst();

/** Admin version — returns any showcase media regardless of publish status,
 *  including orphaned assets owned by the requesting admin (upload previews). */
export const findAdminShowcaseMediaData = (
  db: Database,
  id: string,
  actorId: string,
) =>
  db
    .selectFrom("media_assets as m")
    .selectAll("m")
    .where("m.id", "=", id)
    .where((eb) =>
      eb.or([
        // Owned by this admin (covers freshly-uploaded orphans before save).
        eb("m.created_by", "=", actorId),
        eb.exists(
          eb
            .selectFrom("showcase_records as sr")
            .select("sr.id")
            .where("sr.cover_media_id", "=", eb.ref("m.id")),
        ),
        eb("m.showcase_record_id", "is not", null),
      ]),
    )
    .executeTakeFirst();
