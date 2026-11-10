import type { Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export const createBookingConversationData = (
  db: Transaction<DB>,
  values: { customer_id: string; booking_request_id: string },
) => db.insertInto("conversations").values(values).execute();
