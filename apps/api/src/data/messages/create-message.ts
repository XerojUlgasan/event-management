import {
  clearPendingAiHandoff,
  parseAiHandoff,
} from "../../utils/ai-handoff.js";
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
  requestId?: string,
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
    if (requestId) {
      const previous = await trx
        .selectFrom("messages")
        .selectAll()
        .where("id", "=", requestId)
        .executeTakeFirst();
      if (previous) {
        if (
          previous.conversation_id !== conversation.id ||
          previous.sender_id !== senderId ||
          previous.sender_role !== senderRole ||
          previous.body !== body
        )
          throw new Error("Message request conflict");
        const sender = await trx
          .selectFrom("users")
          .select(["display_name", "email"])
          .where("id", "=", senderId)
          .executeTakeFirstOrThrow();
        return {
          aiEnabled: conversation.ai_enabled,
          aiVersion: conversation.ai_version,
          aiHandoff: parseAiHandoff(conversation.ai_handoff),
          replayed: true,
          message: {
            ...previous,
            sender_display_name: sender.display_name,
            sender_email: sender.email,
          },
        };
      }
    }
    if (
      conversation.status === "closed" &&
      (senderRole === "admin" || conversation.booking_request_id)
    )
      throw new Error("Conversation is closed");
    if (conversation.guest_identity_id) assertGuestActive(conversation);
    const previousHandoff = parseAiHandoff(conversation.ai_handoff);
    const aiHandoff =
      senderRole === "admin"
        ? clearPendingAiHandoff(conversation.ai_handoff)
        : previousHandoff;
    const aiEnabled = senderRole === "admin" ? false : conversation.ai_enabled;
    const aiVersion =
      conversation.ai_version +
      (senderRole === "admin" &&
      (conversation.ai_enabled || previousHandoff?.pending)
        ? 1
        : 0);
    const row = await trx
      .insertInto("messages")
      .values({
        ...(requestId ? { id: requestId } : {}),
        conversation_id: conversation.id,
        created_at: sql<Date>`clock_timestamp()`,
        sender_id: senderId,
        sender_role: senderRole,
        body,
        read_at: null,
      })
      .onConflict((conflict) => conflict.column("id").doNothing())
      .returningAll()
      .executeTakeFirst();
    // Another conversation can insert the same globally unique ID while its
    // row lock is held. Do not expose that message to this customer.
    if (!row) throw new Error("Message request conflict");
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
        ai_handoff: aiHandoff,
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
      aiHandoff,
      replayed: false,
      message: {
        ...row,
        sender_display_name: sender.display_name,
        sender_email: sender.email,
      },
    };
  });
}
