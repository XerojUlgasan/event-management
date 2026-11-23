import { sql, type Kysely } from "kysely";
import { GUEST_INACTIVITY_TTL_MS } from "@event-management/contracts/guest-chat";
import type { DB } from "../../db/types.js";

/** Last human or assistant message, falling back to the conversation's creation. */
export const conversationActivity = (alias = "c") => sql<Date>`coalesce(
  (select max(activity_message.created_at) from messages activity_message
   where activity_message.conversation_id = ${sql.ref(`${alias}.id`)}),
  ${sql.ref(`${alias}.created_at`)})`;

export const guestIsActive = (alias = "c") => sql<boolean>`(
  ${sql.ref(`${alias}.guest_identity_id`)} is null or
  ${conversationActivity(alias)} + ${GUEST_INACTIVITY_TTL_MS} * interval '1 millisecond' > clock_timestamp())`;

// Call after acquiring the conversation row lock: a SELECT containing a subquery
// in the locking statement can see the snapshot from before it waited for a writer.
export async function withConversationActivity<T extends { id: string }>(
  db: Kysely<DB>,
  conversation: T,
) {
  const row = await db
    .selectFrom("conversations as c")
    .select(conversationActivity().as("last_activity_at"))
    .where("c.id", "=", conversation.id)
    .executeTakeFirstOrThrow();

  return { ...conversation, last_activity_at: row.last_activity_at };
}
