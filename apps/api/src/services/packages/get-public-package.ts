import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { listPublicPackageVersionsData } from "../../data/packages/list-public-package-versions.js";

import { publicDto } from "./package-response.js";

export async function getPublicPackageService(db: Kysely<DB>, id: string) {
  const row = (await listPublicPackageVersionsData(db, id))[0];
  return row ? publicDto(row) : null;
}
