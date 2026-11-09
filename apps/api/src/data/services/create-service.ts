import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ServiceContent } from "../../controllers/services/schemas.js";
import { columns } from "./service-columns.js";
export const createServiceData = (
  db: Transaction<DB>,
  data: ServiceContent,
  slug: string,
) =>
  db
    .insertInto("services")
    .values(columns(data, slug))
    .returningAll()
    .executeTakeFirstOrThrow();
