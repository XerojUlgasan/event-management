import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { UpdateShowcaseRecord } from "@event-management/contracts/showcase";
import { lockShowcaseRecordData } from "../../data/showcase-records/lock-showcase-record.js";
import { updateShowcaseRecordData } from "../../data/showcase-records/update-showcase-record.js";
import { replaceShowcaseRecordMediaData } from "../../data/showcase-record-media/replace-showcase-record-media.js";
import { cleanupCatalogMediaService } from "../catalog-media/cleanup-catalog-media.js";
import { showcaseDto } from "./showcase-dto.js";
import { duplicateTitle } from "../../utils/catalog-title.js";

function notFound() {
  return { status: 404 as const, message: "Showcase not found." };
}
function stale() {
  return { status: 409 as const, message: "Showcase changed. Refresh and try again." };
}

export async function updateShowcaseRecordService(
  db: Kysely<DB>,
  id: string,
  content: UpdateShowcaseRecord,
) {
  try {
    let removedMediaIds: string[] = [];

    const outcome = await db.transaction().execute(async (trx) => {
      const current = await lockShowcaseRecordData(trx, id);
      if (!current) return notFound();

      if (current.updated_at.toISOString() !== content.expectedUpdatedAt)
        return stale();

      const now = new Date();
      await updateShowcaseRecordData(trx, id, {
        title: content.title.trim(),
        description: content.description.trim(),
        cover_media_id: content.coverMediaId,
        preview_video_id: content.previewVideoId ?? null,
        updated_at: now,
      });

      removedMediaIds = await replaceShowcaseRecordMediaData(
        trx,
        id,
        content.mediaIds,
      );

      return showcaseDto(trx, { id });
    });

    // Clean up orphaned media after the transaction commits.
    // Don't fail the update if cleanup fails — orphaned media will be retried.
    if (outcome && !("status" in outcome) && removedMediaIds.length) {
      try {
        await cleanupCatalogMediaService(db, removedMediaIds);
      } catch (cleanupError) {
        console.warn(
          "[update-showcase] media cleanup failed, will retry later:",
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        );
      }
    }

    return outcome;
  } catch (cause) {
    const duplicate = duplicateTitle(
      cause,
      "A showcase with this title already exists.",
    );
    if (duplicate) return duplicate;
    throw cause;
  }
}
