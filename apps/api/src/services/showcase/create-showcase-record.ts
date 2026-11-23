import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { CreateShowcaseRecord } from "@event-management/contracts/showcase";
import { catalogSlug } from "@event-management/contracts/catalog-slug";
import { createShowcaseRecordData } from "../../data/showcase-records/create-showcase-record.js";
import { replaceShowcaseGalleryData } from "../../data/showcase-records/replace-showcase-gallery.js";
import { showcaseDto } from "./showcase-dto.js";
import { lockAndValidateShowcaseMedia } from "./validate-showcase-media.js";
import { duplicateTitle } from "../../utils/catalog-title.js";

/** Creates a new showcase record as a draft. Always starts unpublished. */
export async function createShowcaseRecordService(
  db: Kysely<DB>,
  content: CreateShowcaseRecord,
  actorId: string,
) {
  try {
    const slug = catalogSlug(content.title);
    const now = new Date();

    const result = await db.transaction().execute(async (trx) => {
      const invalid = await lockAndValidateShowcaseMedia(trx, content);
      if (invalid) return invalid;

      const record = await createShowcaseRecordData(trx, {
        slug,
        title: content.title.trim(),
        description: content.description.trim(),
        cover_media_id: content.coverMediaId,
        published_at: null, // always draft on creation (BR-03)
        created_by: actorId,
        created_at: now,
        updated_at: now,
      });

      await replaceShowcaseGalleryData(trx, record.id, content.mediaIds);

      return showcaseDto(trx, { id: record.id });
    });

    return result;
  } catch (cause) {
    const duplicate = duplicateTitle(
      cause,
      "A showcase with this title already exists.",
    );
    if (duplicate) return duplicate;
    throw cause;
  }
}
