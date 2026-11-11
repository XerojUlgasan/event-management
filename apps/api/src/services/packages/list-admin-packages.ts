import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listPackagesData } from "../../data/packages/list-packages.js";
import { packageDto } from "./package-response.js";
export async function listAdminPackagesService(db: Kysely<DB>) {
  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) =>
      Promise.all(
        (await listPackagesData(trx)).map((row) => packageDto(trx, row, { includeArchivedServices: true })),
      ),
    );
}
