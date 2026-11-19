import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const lockServiceData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
