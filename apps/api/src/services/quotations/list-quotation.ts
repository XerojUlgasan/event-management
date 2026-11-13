import { z } from "@hono/zod-openapi";
import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import { findQuotationBookingData } from "../../data/quotations/find-quotation-booking.js";
import { currentQuoteData, listQuotesPageData } from "../../data/quotations/list-quotations.js";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import type { DB } from "../../db/types.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { dto, failure } from "./quotation-context.js";

const positionSchema = z.object({ version: z.number().int().positive().max(2147483647) });
export async function listQuotationService(db: Kysely<DB>, bookingId: string, actor: string, customer: boolean, input: { limit: number; cursor?: string; quotationId?: string }) {
  const booking = await findQuotationBookingData(db, bookingId);
  if (!booking || (customer && booking.customer_id !== actor)) return failure("Booking request not found", 404);
  const scope = JSON.stringify(["quotation-history", bookingId, customer ? actor : "admin", input.quotationId ?? null]);
  const position = parsePageCursor(input.cursor, positionSchema, scope);
  const [rows, draft, offer] = await Promise.all([
    listQuotesPageData(db, bookingId, { ...input, customer, beforeVersion: position?.version }),
    customer ? Promise.resolve(undefined) : currentQuoteData(db, bookingId, ["draft"], false, input.quotationId),
    currentQuoteData(db, bookingId, ["sent", "accepted"], customer, input.quotationId),
  ]);
  const previous = draft?.previous_quotation_id ? await findQuoteData(db, draft.previous_quotation_id) : undefined;
  const page = createPage(rows, input.limit, row => encodePageCursor(scope, { version: row.version }));
  return { quotations: page.items.map(dto), nextCursor: page.nextCursor, currentDraft: draft ? dto(draft) : null, currentOffer: offer ? dto(offer) : null, previousDraftVersion: previous?.booking_request_id === bookingId ? previous.version : null };
}
