import type { Transaction } from "kysely";
import type { CreateShowcaseRecord } from "@event-management/contracts/showcase";
import { lockShowcaseMediaData } from "../../data/showcase-records/lock-showcase-media.js";
import type { DB } from "../../db/types.js";

export async function lockAndValidateShowcaseMedia(
  db: Transaction<DB>,
  { coverMediaId, mediaIds }: CreateShowcaseRecord,
  recordId?: string,
) {
  const assets = await lockShowcaseMediaData(
    db,
    [coverMediaId, ...mediaIds],
    recordId,
  );
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  if (byId.get(coverMediaId)?.kind !== "image")
    return {
      status: 400 as const,
      message: "Choose an existing image for the cover.",
    };

  for (const id of mediaIds) {
    const asset = byId.get(id);
    if (asset?.kind !== "image" && asset?.kind !== "video")
      return {
        status: 400 as const,
        message: "Choose existing images or videos for the gallery.",
      };
    if (asset.showcase_record_id && asset.showcase_record_id !== recordId)
      return {
        status: 409 as const,
        message: "A gallery asset already belongs to another showcase.",
      };
  }

  return null;
}
