import { type Insertable, type Transaction } from "kysely";
import type { DB, Quotations } from "../../db/types.js";

export const createQuotationData = (
  db: Transaction<DB>,
  values: Insertable<Quotations>,
) =>
  db
    .insertInto("quotations")
    .values(values)
    .returning("id")
    .executeTakeFirstOrThrow();
