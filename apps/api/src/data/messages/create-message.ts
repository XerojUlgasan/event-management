import { sql, type Kysely } from "kysely";
import {
  assertGuestActive,
  guestExpiry,
} from "../guest-chat/guest-conversation.js";
import type { DB } from "../../db/types.js";

type Database = Kysely<DB>;

export async function createMessageData(
  db: Database,
  conversationId: string,
  senderId: string,
  senderRole: "customer" | "admin",
  body: string,
) {
  return db.transaction().execute(async (trx) => {
    const conversation = await trx
      .selectFrom("conversations")
      .selectAll()
      .where("id", "=", conversationId)
      .forUpdate()
      .executeTakeFirst();
    if (
      !conversation ||
      (senderRole === "customer" && conversation.customer_id !== senderId)
    )
      throw new Error("Conversation not found");
    if (
      conversation.status === "closed" &&
      (senderRole === "admin" || conversation.booking_request_id)
    )
      throw new Error("Conversation is closed");
    if (conversation.guest_identity_id) assertGuestActive(conversation);
    const aiEnabled = senderRole === "admin" ? false : conversation.ai_enabled;
    const aiVersion =
      conversation.ai_version +
      (conversation.ai_enabled && senderRole === "admin" ? 1 : 0);
    const row = await trx
      .insertInto("messages")
      .values({
        conversation_id: conversation.id,
        created_at: sql<Date>`clock_timestamp()`,
        sender_id: senderId,
        sender_role: senderRole,
        body,
        read_at: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("conversations")
      .set({
        updated_at: row.created_at,
        ...(conversation.guest_identity_id
          ? { guest_expires_at: guestExpiry(row.created_at) }
          : {}),
        status: "active",
        closed_at: null,
        ai_enabled: aiEnabled,
        ai_version: aiVersion,
      })
      .where("id", "=", conversation.id)
      .execute();
    const sender = await trx
      .selectFrom("users")
      .select(["display_name", "email"])
      .where("id", "=", senderId)
      .executeTakeFirstOrThrow();
    return {
      aiEnabled,
      aiVersion,
      message: {
        ...row,
        sender_display_name: sender.display_name,
        sender_email: sender.email,
      },
    };
  });
}
