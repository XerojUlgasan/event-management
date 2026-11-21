import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

const SINGLETON_ID = 1;

export async function lockBusinessInformationData(db: Transaction<DB>) {
  return db
    .selectFrom("business_information")
    .selectAll()
    .where("id", "=", SINGLETON_ID)
    .forUpdate()
    .executeTakeFirst();
}
