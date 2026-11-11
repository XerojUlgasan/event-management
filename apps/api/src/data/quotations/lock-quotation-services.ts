import { type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const lockItemServicesData = (db: Transaction<DB>, ids: string[]) =>
  db
    .selectFrom("services")
    .select(["id", "archived_at"])
    .where("id", "in", ids)
    .orderBy("id")
    .forUpdate()
    .execute();
