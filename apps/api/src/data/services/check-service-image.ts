import { type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

import { imageId } from "../../utils/services/service-image-id.js";

type Database = Kysely<DB> | Transaction<DB>;

export async function checkServiceImageData(db: Transaction<DB>, url: string | null) {
  const id = imageId(url);
  return !id || !!await db.selectFrom("service_images").select("id").where("id", "=", id).executeTakeFirst();
}
