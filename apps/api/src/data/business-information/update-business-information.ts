import type { Json } from "../../db/types.js";
import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

const SINGLETON_ID = 1;

export async function updateBusinessInformationData(
  db: Transaction<DB>,
  information: Json,
  updatedAt: Date,
) {
  return db
    .updateTable("business_information")
    .set({ information, updated_at: updatedAt })
    .where("id", "=", SINGLETON_ID)
    .returning(["information", "updated_at"])
    .executeTakeFirstOrThrow();
}
