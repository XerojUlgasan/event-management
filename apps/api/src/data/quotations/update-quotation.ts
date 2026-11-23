import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { nextQuoteRevision } from "./quotation-revision.js";

export const supersedeQuotationData = (
  db: Transaction<DB>,
  id: string,
  now: Date,
) =>
  db
    .updateTable("quotations")
    .set({
      status: "superseded",
      superseded_at: now,
      updated_at: nextQuoteRevision,
    })
    .where("id", "=", id)
    .where("status", "=", "sent")
    .execute();
