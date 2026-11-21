import { z } from "@hono/zod-openapi";
import { createPage } from "@event-management/contracts/pagination";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Status } from "../../controllers/booking-requests/schemas.js";
import { listAdminBookingRequestsPageData } from "../../data/booking-requests/list-admin-booking-requests-page.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { bookingRequestDtos } from "./booking-request-response.js";

const positionSchema = z.object({
  submittedAt: z.iso
    .datetime()
    .refine(
      (value) =>
        !value.startsWith("0000-") &&
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value),
    ),
  id: z.string().uuid(),
});

export async function listAdminBookingRequestsPageService(
  db: Kysely<DB>,
  input: {
    status?: Status;
    preferredDate?: string;
    customerId?: string;
    cursor?: string;
    limit: number;
  },
) {
  const scope = JSON.stringify([
    "booking-requests",
    input.customerId ?? null,
    input.status ?? null,
    input.preferredDate ?? null,
  ]);
  const position = parsePageCursor(input.cursor, positionSchema, scope);
  const rows = await listAdminBookingRequestsPageData(db, {
    ...input,
    position,
  });

  const page = createPage(rows, input.limit, (row) =>
    encodePageCursor(scope, { submittedAt: row.cursor_submitted_at, id: row.id }),
  );

  return {
    bookingRequests: await bookingRequestDtos(db, page.items),
    nextCursor: page.nextCursor,
  };
}
