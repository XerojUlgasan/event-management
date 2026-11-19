import type { QuotationItem } from "@event-management/contracts/quotations";
import type { Kysely } from "kysely";
import { findQuoteData } from "../../data/quotations/find-quotation.js";
import { lockItemServicesData } from "../../data/quotations/lock-quotation-services.js";
import { updateQuotationData } from "../../data/quotations/update-quotation.js";
import type { DB } from "../../db/types.js";
import {
  amount,
  audit,
  closed,
  dto,
  failure,
  locked,
} from "./quotation-context.js";

export async function saveQuotationService(
  db: Kysely<DB>,
  id: string,
  actor: string,
  expected: string,
  items: QuotationItem[],
) {
  return db.transaction().execute(async (trx) => {
    const found = await locked(trx, id);

    if (!found) return failure("Quotation not found", 404);

    const { row, booking } = found;

    if (row.revision !== expected)
      return failure("Quotation changed. Refresh and try again", 409);

    if (closed(booking) || row.status !== "draft")
      return failure("Only an open draft can be edited", 409);

    const ids = [
      ...new Set(
        items.flatMap((item) => (item.serviceId ? [item.serviceId] : [])),
      ),
    ];

    if (ids.length) {
      const services = await lockItemServicesData(trx, ids);

      if (services.length !== ids.length || services.some((s) => s.archived_at))
        return failure("A selected service is unavailable", 400);
    }

    const total = amount(row.base_amount_minor, items);

    if (total === null)
      return failure("Quotation total is outside the supported range", 400);

    await updateQuotationData(trx, id, {
      items: JSON.stringify(items),
      total_amount_minor: total,
      adjustments_reviewed: true,
    });
    await audit(trx, actor, "quotation.updated", id, {
      itemCount: items.length,
    });

    return dto((await findQuoteData(trx, id))!);
  });
}
