import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { createServiceImageData } from "../../data/services/create-service-image.js";

export async function uploadServiceImageService(db: Kysely<DB>, contentType: string, data: Buffer) {
  const row = await createServiceImageData(db, contentType, data);
  return `/v1/service-images/${row.id}`;
}
