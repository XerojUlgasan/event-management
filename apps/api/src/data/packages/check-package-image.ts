import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

import { imageId } from "../../utils/packages/package-image-id.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function checkPackageImageData(db: Transaction<DB>, url: string | null) {
  const id = imageId(url);
  return !id || !!await db.selectFrom("package_images").select("id").where("id", "=", id).executeTakeFirst();
}
