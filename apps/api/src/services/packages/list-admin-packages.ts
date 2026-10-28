import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { listPackagesData } from "../../data/packages/list-packages.js";

import { adminDto } from "./package-response.js";

export async function listAdminPackagesService(db: Kysely<DB>) {
  return Promise.all((await listPackagesData(db)).map(row => adminDto(db, row)));
}
