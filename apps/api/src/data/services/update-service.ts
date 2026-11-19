import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { columns } from "./service-columns.js";

export const updateServiceData = (
  db: Transaction<DB>,
  id: string,
  data: ServiceContent,
  slug: string,
  now: Date,
) =>
  db
    .updateTable("services")
    .set({ ...columns(data, slug), updated_at: now })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
