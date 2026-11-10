import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { findBookingRequestData } from "../../data/booking-requests/find-booking-request.js";
import { bookingRequestDtos } from "./booking-request-response.js";

export async function getBookingRequestService(
  db: Kysely<DB>,
  id: string,
  customerId?: string,
) {
  const row = await findBookingRequestData(db, id, customerId);
  return row ? (await bookingRequestDtos(db, [row]))[0]! : null;
}
