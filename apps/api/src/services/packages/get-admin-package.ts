import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { findPackageData } from "../../data/packages/find-package.js";

import { adminDto } from "./package-response.js";

export async function getAdminPackageService(db: Kysely<DB>, id: string) {
  const row = await findPackageData(db, id);
  return row ? adminDto(db, row) : null;
}
