import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listBookingRequestsData } from "../../data/booking-requests/list-booking-requests.js";
import { bookingRequestDtos } from "./booking-request-response.js";

export async function listBookingRequestsService(
  db: Kysely<DB>,
  customerId?: string,
) {
  return bookingRequestDtos(db, await listBookingRequestsData(db, customerId));
}
