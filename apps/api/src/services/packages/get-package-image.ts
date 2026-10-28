import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { hasAdminSessionService } from "../auth/has-admin-session.js";

import { findPackageImageData } from "../../data/packages/find-package-image.js";
import { findPublishedPackageImageData } from "../../data/packages/find-published-package-image.js";

export async function getPackageImageService(db: Kysely<DB>, id: string, sessionToken?: string) {
  if (!await findPublishedPackageImageData(db, id) && !await hasAdminSessionService(db, sessionToken)) return null;
  return await findPackageImageData(db, id) ?? null;
}
