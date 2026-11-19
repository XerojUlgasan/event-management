import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listPublicPackagesData } from "../../data/packages/list-public-packages.js";
import { packageDto } from "./package-response.js";

export async function getPublicPackageService(db: Kysely<DB>, id: string) {
  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) => {
      const row = (await listPublicPackagesData(trx, id))[0];

      return row ? packageDto(trx, row) : null;
    });
}
