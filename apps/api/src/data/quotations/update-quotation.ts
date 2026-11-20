import { type Transaction, type Updateable } from "kysely";
import type { DB, Quotations } from "../../db/types.js";
import { nextQuoteRevision } from "./quotation-revision.js";

export const updateQuotationData = (
  db: Transaction<DB>,
  id: string,
  values: Updateable<Quotations>,
) =>
  db
    .updateTable("quotations")
    .set({ ...values, updated_at: nextQuoteRevision })
    .where("id", "=", id)
    .execute();

export const supersedeActiveQuotationsData = (
  db: Transaction<DB>,
  bookingId: string,
  now: Date,
) =>
  db
    .updateTable("quotations")
    .set({
      status: "superseded",
      superseded_at: now,
      updated_at: nextQuoteRevision,
    })
    .where("booking_request_id", "=", bookingId)
    .where("status", "=", "sent")
    .execute();
