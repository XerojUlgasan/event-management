import { type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { quoteRevision, type Database } from "./quotation-revision.js";

export const findQuoteData = (db: Database, id: string) =>
  db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("id", "=", id)
    .executeTakeFirst();

export const lockQuoteData = (db: Transaction<DB>, id: string) =>
  db
    .selectFrom("quotations")
    .selectAll()
    .select(quoteRevision.as("revision"))
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
