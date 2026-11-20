import { z } from "@hono/zod-openapi";
import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import { findQuotationBookingData } from "../../data/quotations/find-quotation-booking.js";
import {
  latestDeliveredQuoteData,
  listQuotesPageData,
} from "../../data/quotations/list-quotations.js";
import type { DB } from "../../db/types.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { customerDto, dto, failure } from "./quotation-context.js";

const positionSchema = z.object({
  version: z.number().int().positive().max(2147483647),
});

export async function listQuotationService(
  db: Kysely<DB>,
  bookingId: string,
  actor: string,
  customer: boolean,
  input: { limit: number; cursor?: string; quotationId?: string },
) {
  const booking = await findQuotationBookingData(db, bookingId);

  if (!booking || (customer && booking.customer_id !== actor))
    return failure("Booking request not found", 404);

  const scope = JSON.stringify([
    "quotation-history",
    bookingId,
    customer ? actor : "admin",
    input.quotationId ?? null,
  ]);
  const position = parsePageCursor(input.cursor, positionSchema, scope);

  const [rows, offer] = await db
    .transaction()
    .setIsolationLevel("repeatable read")
    .setAccessMode("read only")
    .execute(
      async (trx) =>
        [
          await listQuotesPageData(trx, bookingId, {
            ...input,
            beforeVersion: position?.version,
          }),
          await latestDeliveredQuoteData(trx, bookingId),
        ] as const,
    );

  const page = createPage(rows, input.limit, (row) =>
    encodePageCursor(scope, { version: row.version }),
  );

  const toQuotation = customer ? customerDto : dto;

  return {
    quotations: page.items.map(toQuotation),
    nextCursor: page.nextCursor,
    currentOffer: offer ? toQuotation(offer) : null,
  };
}
