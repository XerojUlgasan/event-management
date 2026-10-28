import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { listPublicPackageVersionsData } from "../../data/packages/list-public-package-versions.js";

import { publicDto } from "./package-response.js";

export async function listPublicPackagesService(db: Kysely<DB>) {
  return (await listPublicPackageVersionsData(db)).map(publicDto);
}
