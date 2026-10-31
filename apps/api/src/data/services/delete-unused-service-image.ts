import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

import { imageId } from "../../utils/services/service-image-id.js";
import { imageObjectKey, type ImageContentType } from "../../utils/upload-image-to-r2.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function deleteUnusedServiceImageData(db: Transaction<DB>, url: string | null) {
  const id = imageId(url);
  if (!id) return null;
  const referenced = await db.selectFrom("service_versions").select("id").where("image_url", "=", `/v1/service-images/${id}`).executeTakeFirst();
  if (referenced) return null;
  const row = await db.deleteFrom("service_images").where("id", "=", id).returning(["id", "content_type"]).executeTakeFirst();
  return row ? imageObjectKey("services", row.id, row.content_type as ImageContentType) : null;
}
