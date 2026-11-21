import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

const SINGLETON_ID = 1;

export async function getBusinessInformationData(db: Kysely<DB>) {
  return db
    .selectFrom("business_information")
    .select(["information", "updated_at"])
    .where("id", "=", SINGLETON_ID)
    .executeTakeFirst();
}
