import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

import { imageId } from "../../utils/packages/package-image-id.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function deleteUnusedPackageImageData(db: Transaction<DB>, url: string | null) {
  const id = imageId(url);
  if (!id) return false;
  const referenced = await db.selectFrom("package_versions").select("id").where("image_url", "=", `/v1/package-images/${id}`).executeTakeFirst();
  if (referenced) return false;
  await db.deleteFrom("package_images").where("id", "=", id).execute();
  return true;
}
