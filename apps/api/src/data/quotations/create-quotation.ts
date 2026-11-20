import { type Insertable, type Transaction } from "kysely";
import type { DB, Quotations } from "../../db/types.js";
import { quoteRevision } from "./quotation-revision.js";

export const createQuotationData = (
  db: Transaction<DB>,
  values: Insertable<Quotations>,
) =>
  db
    .insertInto("quotations")
    .values(values)
    .returningAll()
    .returning(quoteRevision.as("revision"))
    .executeTakeFirstOrThrow();
