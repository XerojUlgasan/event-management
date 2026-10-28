import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

import { imageId } from "../../utils/packages/package-image-id.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function lockPackageImagesData(db: Transaction<DB>, urls: (string | null)[]) {
  const ids = [...new Set(urls.map(imageId).filter((id): id is string => id !== null))].sort();
  for (const id of ids) await db.selectFrom("package_images").select("id").where("id", "=", id).forUpdate().executeTakeFirst();
}
