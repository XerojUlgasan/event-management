import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

import { imageId } from "../../utils/services/service-image-id.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function lockServiceImagesData(db: Transaction<DB>, urls: (string | null)[]) {
  const ids = [...new Set(urls.map(imageId).filter((id): id is string => id !== null))].sort();
  for (const id of ids) await db.selectFrom("service_images").select("id").where("id", "=", id).forUpdate().executeTakeFirst();
}
