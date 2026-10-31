import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { hasAdminSessionService } from "../auth/has-admin-session.js";

import { findPackageImageData } from "../../data/packages/find-package-image.js";
import { findPublishedPackageImageData } from "../../data/packages/find-published-package-image.js";
import { imageObjectKey, type ImageContentType } from "../../utils/upload-image-to-r2.js";
import { getImageFromR2 } from "../../utils/r2-image-storage.js";

export async function getPackageImageService(db: Kysely<DB>, id: string, sessionToken?: string) {
  if (!await findPublishedPackageImageData(db, id) && !await hasAdminSessionService(db, sessionToken)) return null;
  const row = await findPackageImageData(db, id);
  if (!row) return null;
  const data = await getImageFromR2(imageObjectKey("packages", row.id, row.content_type as ImageContentType));
  return data ? { data, content_type: row.content_type } : null;
}
