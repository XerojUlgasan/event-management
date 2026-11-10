import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { Status } from "../../controllers/booking-requests/schemas.js";
import { listAdminBookingRequestsPageData } from "../../data/booking-requests/list-admin-booking-requests-page.js";
import { bookingRequestDtos } from "./booking-request-response.js";

export async function listAdminBookingRequestsPageService(
  db: Kysely<DB>,
  input: {
    status?: Status;
    preferredDate?: string;
    cursor?: string;
    limit: number;
  },
) {
  const rows = await listAdminBookingRequestsPageData(db, input);
  const page = rows.slice(0, input.limit);
  return {
    bookingRequests: await bookingRequestDtos(db, page),
    nextCursor: rows.length > input.limit ? page[page.length - 1]!.id : null,
  };
}
