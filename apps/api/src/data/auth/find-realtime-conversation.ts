import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import type { SessionContext } from "../../types/hono.js";

export function findRealtimeConversationData(
  db: Kysely<DB>,
  session: SessionContext,
  conversationId: string,
) {
  return db
    .selectFrom("conversations")
    .innerJoin("sessions", (join) =>
      join.on("sessions.id", "=", session.sessionId),
    )
    .innerJoin("users", "users.id", "sessions.user_id")
    .select("conversations.id")
    .where("conversations.id", "=", conversationId)
    .where("conversations.customer_id", "is not", null)
    .where("conversations.guest_identity_id", "is", null)
    .where("sessions.user_id", "=", session.user.id)
    .where("sessions.expires_at", ">", new Date())
    .where(({ eb, and, or }) =>
      or([
        eb("users.role", "=", "admin"),
        and([
          eb("users.role", "=", "customer"),
          eb("conversations.customer_id", "=", session.user.id),
        ]),
      ]),
    )
    .executeTakeFirst();
}
