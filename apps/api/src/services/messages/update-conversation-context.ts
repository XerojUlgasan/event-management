import type { Kysely, Updateable } from "kysely";
import type { DB, Conversations } from "../../db/types.js";
import type { ConversationWithCustomer } from "../../data/messages/types.js";
import { expireConversationsData } from "../../data/messages/expire-conversations.js";
import { ensureConversationData } from "../../data/messages/ensure-conversation.js";
import { updateConversationContextData } from "../../data/messages/update-conversation.js";
import { findConversationData } from "../../data/messages/find-conversation.js";
import { getPublicPackageService } from "../packages/get-public-package.js";
import { getConversationThreadService } from "./get-conversation-thread.js";

export type ConversationContextInput = {
  conversationId?: string;
  packageId?: string | null;
  eventType?: string | null;
  eventStartsAt?: string | null;
  eventEndsAt?: string | null;
  guestCount?: number | null;
};

export async function conversationContextValues(
  db: Kysely<DB>,
  input: ConversationContextInput,
): Promise<Updateable<Conversations> | null> {
  const values: Updateable<Conversations> = {};
  if (input.packageId !== undefined) {
    if (input.packageId !== null && !(await getPublicPackageService(db, input.packageId))) {
      return null;
    }
    values.package_id = input.packageId;
  }
  if (input.eventType !== undefined) values.event_type = input.eventType;
  if (input.eventStartsAt !== undefined) {
    values.event_starts_at = input.eventStartsAt ? new Date(input.eventStartsAt) : null;
  }
  if (input.eventEndsAt !== undefined) {
    values.event_ends_at = input.eventEndsAt ? new Date(input.eventEndsAt) : null;
  }
  if (input.guestCount !== undefined) values.guest_count = input.guestCount;
  return values;
}

export function eventWindowInvalid(
  conversation: ConversationWithCustomer,
  values: Updateable<Conversations>,
) {
  const startsAt =
    values.event_starts_at !== undefined ? values.event_starts_at : conversation.event_starts_at;
  const endsAt =
    values.event_ends_at !== undefined ? values.event_ends_at : conversation.event_ends_at;
  return (
    startsAt instanceof Date && endsAt instanceof Date && endsAt.getTime() < startsAt.getTime()
  );
}

export async function updateConversationContextService(
  db: Kysely<DB>,
  customerId: string,
  input: ConversationContextInput,
) {
  await expireConversationsData(db);
  const conversation = input.conversationId
    ? await findConversationData(db, input.conversationId)
    : await ensureConversationData(db, customerId);
  if (!conversation || conversation.customer_id !== customerId) return { kind: "invalid-package" as const };
  const values = await conversationContextValues(db, input);
  if (!values) return { kind: "invalid-package" as const };
  if (eventWindowInvalid(conversation, values)) return { kind: "invalid-dates" as const };
  await updateConversationContextData(db, conversation, values);
  const updated = await ensureConversationData(db, customerId);
  return {
    kind: "ok" as const,
    thread: await getConversationThreadService(db, updated, "customer"),
  };
}
