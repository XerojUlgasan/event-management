import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export async function findLatestCustomerBookingDraftData(
  db: Kysely<DB>,
  customerId: string,
) {
  const row = await db
    .selectFrom("conversations as c")
    .innerJoin("booking_requests as br", "br.id", "c.booking_request_id")
    .select(["c.id as conversation_id", "br.event_type"])
    .where("c.customer_id", "=", customerId)
    .where("br.customer_id", "=", customerId)
    .where("br.submitted_at", "is", null)
    .orderBy("br.updated_at", "desc")
    .orderBy("br.id", "desc")
    .executeTakeFirst();

  return row
    ? { conversationId: row.conversation_id, eventType: row.event_type }
    : null;
}
