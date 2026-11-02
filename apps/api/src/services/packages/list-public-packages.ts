import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listPublicPackagesData } from "../../data/packages/list-public-packages.js";
import { packageDto } from "./package-response.js";
export async function listPublicPackagesService(
  db: Kysely<DB>,
  page?: { limit: number; offset: number },
) {
  return db
    .transaction()
    .setIsolationLevel("repeatable read")
    .execute(async (trx) =>
      Promise.all(
        (await listPublicPackagesData(trx, undefined, page)).map((row) =>
          packageDto(trx, row),
        ),
      ),
    );
}
