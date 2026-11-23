import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

/**
 * Returns a media_assets row only when it is referenced by at least one
 * published showcase record (via cover, preview_video, or gallery link).
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
        // Referenced as preview video of a published record.
        eb.exists(
          eb
            .selectFrom("showcase_records as sr")
            .select("sr.id")
            .where("sr.published_at", "is not", null)
            .where("sr.preview_video_id", "=", eb.ref("m.id")),
        ),
        // Referenced in gallery of a published record.
        eb.exists(
          eb
            .selectFrom("showcase_record_media as srm")
            .innerJoin("showcase_records as sr", "sr.id", "srm.record_id")
            .select("srm.id")
            .where("sr.published_at", "is not", null)
            .where("srm.media_id", "=", eb.ref("m.id")),
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
        eb.exists(
          eb
            .selectFrom("showcase_records as sr")
            .select("sr.id")
            .where("sr.preview_video_id", "=", eb.ref("m.id")),
        ),
        eb.exists(
          eb
            .selectFrom("showcase_record_media as srm")
            .select("srm.id")
            .where("srm.media_id", "=", eb.ref("m.id")),
        ),
      ]),
    )
    .executeTakeFirst();
