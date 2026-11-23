import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { listAdminConversationsService } from "./list-admin-conversations.js";
import { findLatestCustomerBookingDraftData } from "../../data/messages/find-latest-customer-booking-draft.js";

export async function listCustomerConversationsService(
  db: Kysely<DB>,
  customerId: string,
  limit: number,
  cursor?: string,
  reference?: string,
  includeLatestBookingDraft = false,
) {
  const result = await listAdminConversationsService(
    db,
    limit,
    cursor,
    customerId,
    reference,
  );

  if (!includeLatestBookingDraft) return result;

  return {
    ...result,
    latestBookingDraft: await findLatestCustomerBookingDraftData(
      db,
      customerId,
    ),
  };
}
