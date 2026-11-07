import { sql, type Insertable, type Kysely, type Selectable, type Transaction, type Updateable } from "kysely";
import type { CustomizationRequests, DB } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export type CustomizationRequestRow = Selectable<CustomizationRequests> & {
  requested_by_name: string | null;
  requested_by_email: string;
  decided_by_name: string | null;
  decided_by_email: string | null;
};

export type AdminCustomizationRequestRow = CustomizationRequestRow & {
  booking_request_reference: string;
  customer_display_name: string | null;
  customer_email: string;
  package_name: string;
  event_type: string;
};

export function createCustomizationRequestData(
  db: Transaction<DB>,
  values: Insertable<CustomizationRequests>,
) {
  return db
    .insertInto("customization_requests")
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function findCustomizationRequestForUpdateData(
  db: Transaction<DB>,
  id: string,
) {
  return db
    .selectFrom("customization_requests")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
}

export function updateCustomizationRequestData(
  db: Transaction<DB>,
  id: string,
  values: Updateable<CustomizationRequests>,
) {
  return db
    .updateTable("customization_requests")
    .set(values)
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function listCustomizationRequestsByBookingIdsData(
  db: Database,
  bookingIds: string[],
): Promise<CustomizationRequestRow[]> {
  if (!bookingIds.length) return Promise.resolve([]);
  return db
    .selectFrom("customization_requests as cr")
    .innerJoin("users as requester", "requester.id", "cr.requested_by")
    .leftJoin("users as decider", "decider.id", "cr.decided_by")
    .selectAll("cr")
    .select([
      "requester.display_name as requested_by_name",
      "requester.email as requested_by_email",
      "decider.display_name as decided_by_name",
      "decider.email as decided_by_email",
    ])
    .where("cr.booking_request_id", "in", bookingIds)
    .orderBy("cr.created_at", "desc")
    .orderBy("cr.id", "desc")
    .execute();
}

export function findConversationForCustomizationData(
  db: Database,
  conversationId: string,
  bookingRequestId: string,
  customerId: string,
) {
  return db
    .selectFrom("conversations")
    .select(["id", "booking_request_id", "customer_id"])
    .where("id", "=", conversationId)
    .where("booking_request_id", "=", bookingRequestId)
    .where("customer_id", "=", customerId)
    .executeTakeFirst();
}

export function findMessageForCustomizationData(
  db: Database,
  messageId: string,
  conversationId: string,
) {
  return db
    .selectFrom("messages")
    .select(["id", "conversation_id"])
    .where("id", "=", messageId)
    .where("conversation_id", "=", conversationId)
    .executeTakeFirst();
}

export function listAdminCustomizationRequestsPageData(
  db: Database,
  input: { status?: string; cursor?: string; limit: number },
): Promise<AdminCustomizationRequestRow[]> {
  let query = db
    .selectFrom("customization_requests as cr")
    .innerJoin("booking_requests as br", "br.id", "cr.booking_request_id")
    .innerJoin("users as customer", "customer.id", "br.customer_id")
    .innerJoin("users as requester", "requester.id", "cr.requested_by")
    .leftJoin("users as decider", "decider.id", "cr.decided_by")
    .selectAll("cr")
    .select([
      "requester.display_name as requested_by_name",
      "requester.email as requested_by_email",
      "decider.display_name as decided_by_name",
      "decider.email as decided_by_email",
      "br.reference as booking_request_reference",
      "customer.display_name as customer_display_name",
      "customer.email as customer_email",
      "br.package_name",
      "br.event_type",
    ]);
  if (input.status) query = query.where("cr.status", "=", input.status);
  if (input.cursor) {
    query = query.where(
      sql<boolean>`(cr.created_at, cr.id) < (select created_at, id from customization_requests where id = ${input.cursor}::uuid)`,
    );
  }
  return query
    .orderBy("cr.created_at", "desc")
    .orderBy("cr.id", "desc")
    .limit(input.limit + 1)
    .execute();
}
