import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const deleteServiceData = (db: Transaction<DB>, id: string) =>
  db.deleteFrom("services").where("id", "=", id).execute();
