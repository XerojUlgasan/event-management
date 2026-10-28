import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { createPackageImageData } from "../../data/packages/create-package-image.js";

export async function uploadPackageImageService(db: Kysely<DB>, contentType: string, data: Buffer) {
  const row = await createPackageImageData(db, contentType, data);
  return `/v1/package-images/${row.id}`;
}
