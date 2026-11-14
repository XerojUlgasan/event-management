import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listAdminConversationsService } from "./list-admin-conversations.js";
export function listCustomerConversationsService(
  db: Kysely<DB>,
  customerId: string,
  limit: number,
  cursor?: string,
  reference?: string,
) {
  return listAdminConversationsService(
    db,
    limit,
    cursor,
    customerId,
    reference,
  );
}
