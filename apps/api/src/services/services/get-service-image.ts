import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { hasAdminSessionService } from "../auth/has-admin-session.js";

import { findServiceImageData } from "../../data/services/find-service-image.js";
import { findPublishedServiceImageData } from "../../data/services/find-published-service-image.js";

export async function getServiceImageService(db: Kysely<DB>, id: string, sessionToken?: string) {
  if (!await findPublishedServiceImageData(db, id) && !await hasAdminSessionService(db, sessionToken)) return null;
  return await findServiceImageData(db, id) ?? null;
}
