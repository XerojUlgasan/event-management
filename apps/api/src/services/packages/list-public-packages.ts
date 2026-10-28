import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { listPublicPackageVersionsData } from "../../data/packages/list-public-package-versions.js";

import { publicDto } from "./package-response.js";

export async function listPublicPackagesService(db: Kysely<DB>, page?: { limit: number; offset: number }) {
  const result = [];
  for (const row of await listPublicPackageVersionsData(db, undefined, page)) result.push(await publicDto(db, row));
  return result;
}
