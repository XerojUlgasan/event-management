import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import { itemSchema } from "../../controllers/quotations/schemas.js";
import { createQuotationData } from "../../data/quotations/create-quotation.js";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import { quotationWriteStateData } from "../../data/quotations/list-quotations.js";
import { updateQuotationData } from "../../data/quotations/update-quotation.js";
import type { DB } from "../../db/types.js";
import {
  amount,
  audit,
  basePrice,
  proposalPackage,
  closed,
  dto,
  failure,
  locked,
} from "./quotation-context.js";

export async function reviseQuotationService(
  db: Kysely<DB>,
  id: string,
  actor: string,
  expected: string,
  reason: string,
) {
  return db.transaction().execute(async (trx) => {
    const found = await locked(trx, id);
    if (!found) return failure("Quotation not found", 404);
    const { row, booking } = found;
    if (row.revision !== expected)
      return failure("Quotation changed. Refresh and try again", 409);
    if (closed(booking) || !["draft", "sent", "accepted"].includes(row.status))
      return failure("Only an active quotation can be revised", 409);
    const rows = await quotationWriteStateData(trx, booking.id, id);
    if (rows.has_other_draft)
      return failure("A quotation draft already exists", 409);
    const pkg = await proposalPackage(trx, booking);
    const base = basePrice(pkg.price);
    if (base === null)
      return failure("Package price is outside the supported range", 400);
    const items = z.array(itemSchema).parse(row.items);
    const total = amount(base, items);
    if (total === null)
      return failure(
        "Revised quotation total is outside the supported range",
        409,
      );
    await updateQuotationData(trx, id, {
      status: "superseded",
      superseded_at: new Date(),
    });
    const draft = await createQuotationData(trx, {
      booking_request_id: booking.id,
      version: rows.max_version + 1,
      currency: "PHP",
      base_amount_minor: base,
      total_amount_minor: total,
      status: "draft",
      created_by: actor,
      offered_package_id: pkg.id,
      items: JSON.stringify(items),
      adjustments_reviewed: false,
      previous_quotation_id: id,
      revision_reason: reason,
    });
    await audit(trx, actor, "quotation.revised", draft.id, {
      previousQuotationId: id,
      reason,
    });
    return dto((await findQuoteData(trx, draft.id))!);
  });
}
