import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import type { ConversationWithCustomer } from "./types.js";

type Database = Kysely<DB>;
type TransactionDatabase = Transaction<DB>;

async function insertMessageData(
  db: TransactionDatabase,
  conversationId: string,
  senderId: string,
  senderRole: "customer" | "admin",
  body: string,
) {
  const row = await db
    .insertInto("messages")
    .values({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      body,
      read_at: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  await db
    .updateTable("conversations")
    .set({
      updated_at: row.created_at,
    })
    .where("id", "=", conversationId)
    .execute();
  const sender = await db
    .selectFrom("users")
    .select(["display_name", "email"])
    .where("id", "=", senderId)
    .executeTakeFirstOrThrow();
  return {
    ...row,
    sender_display_name: sender.display_name,
    sender_email: sender.email,
  };
}

export async function createMessageData(
  db: Database,
  conversation: ConversationWithCustomer,
  senderId: string,
  senderRole: "customer" | "admin",
  body: string,
) {
  return db.transaction().execute((trx) =>
    insertMessageData(trx, conversation.id, senderId, senderRole, body),
  );
}

export async function createBookingMessageData(
  db: TransactionDatabase,
  bookingRequestId: string,
  customerId: string,
  senderId: string,
  senderRole: "customer" | "admin",
  body: string,
) {
  let conversation = await db
    .selectFrom("conversations")
    .select("id")
    .where("booking_request_id", "=", bookingRequestId)
    .executeTakeFirst();
  if (!conversation) {
    conversation = await db
      .insertInto("conversations")
      .values({ customer_id: customerId, booking_request_id: bookingRequestId })
      .returning("id")
      .executeTakeFirstOrThrow();
  }
  return insertMessageData(db, conversation.id, senderId, senderRole, body);
}
