import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

import { imageId } from "../../utils/packages/package-image-id.js";
import { imageObjectKey, type ImageContentType } from "../../utils/upload-image-to-r2.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function deleteUnusedPackageImageData(db: Transaction<DB>, url: string | null) {
  const id = imageId(url);
  if (!id) return null;
  const referenced = await db.selectFrom("package_versions").select("id").where("image_url", "=", `/v1/package-images/${id}`).executeTakeFirst();
  if (referenced) return null;
  const row = await db.deleteFrom("package_images").where("id", "=", id).returning(["id", "content_type"]).executeTakeFirst();
  return row ? imageObjectKey("packages", row.id, row.content_type as ImageContentType) : null;
}
