import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findPackageData } from "../../data/packages/find-package.js";
import { packageDto } from "./package-response.js";
export async function getAdminPackageService(db: Kysely<DB>, id: string) {
  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const row = await findPackageData(trx, id);
      return row ? packageDto(trx, row) : null;
    });
}
