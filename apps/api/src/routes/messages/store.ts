import type { Kysely, Selectable } from "kysely";
import type { DB, Conversations, Messages } from "../../db/types.js";

type Database = Kysely<DB>;
type ConversationRow = Selectable<Conversations>;

export type ConversationWithCustomer = ConversationRow & {
  customer_display_name: string | null;
  customer_email: string;
};

export type MessageWithSender = Selectable<Messages> & {
  sender_display_name: string | null;
  sender_email: string;
};

export type MessageDto = {
  id: string;
  body: string;
  senderId: string;
  senderRole: "admin" | "customer";
  senderName: string;
  createdAt: string;
  readAt: string | null;
};

export type ConversationDto = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
};

export function messageDto(row: MessageWithSender, customerId: string): MessageDto {
  return {
    id: row.id,
    body: row.body,
    senderId: row.sender_id,
    senderRole: row.sender_id === customerId ? "customer" : "admin",
    senderName: row.sender_display_name ?? row.sender_email,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at?.toISOString() ?? null,
  };
}

export function conversationDto(
  row: ConversationWithCustomer,
  lastMessage: MessageDto | null,
  unreadCount: number,
): ConversationDto {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_display_name ?? row.customer_email,
    customerEmail: row.customer_email,
    lastMessage,
    unreadCount,
    updatedAt: row.updated_at.toISOString(),
  };
}

function conversationColumns(db: Database) {
  return db
    .selectFrom("conversations as c")
    .innerJoin("users as customer", "customer.id", "c.customer_id")
    .select((eb) => [
      "c.id",
      "c.customer_id",
      "c.created_at",
      "c.updated_at",
      eb.ref("customer.display_name").as("customer_display_name"),
      eb.ref("customer.email").as("customer_email"),
    ]);
}

export async function ensureConversation(db: Database, customerId: string) {
  await db
    .insertInto("conversations")
    .values({ customer_id: customerId })
    .onConflict((conflict) => conflict.column("customer_id").doNothing())
    .execute();
  return conversationColumns(db)
    .where("c.customer_id", "=", customerId)
    .executeTakeFirstOrThrow();
}

export async function findConversation(db: Database, id: string) {
  return conversationColumns(db).where("c.id", "=", id).executeTakeFirst();
}

function messageColumns(db: Database, conversationId: string) {
  return db
    .selectFrom("messages as m")
    .innerJoin("users as sender", "sender.id", "m.sender_id")
    .select((eb) => [
      "m.id",
      "m.conversation_id",
      "m.sender_id",
      "m.body",
      "m.created_at",
      "m.read_at",
      eb.ref("sender.display_name").as("sender_display_name"),
      eb.ref("sender.email").as("sender_email"),
    ])
    .where("m.conversation_id", "=", conversationId);
}

export async function threadMessages(db: Database, conversationId: string) {
  return messageColumns(db, conversationId)
    .orderBy("m.created_at", "asc")
    .orderBy("m.id", "asc")
    .execute();
}

async function lastMessages(db: Database, conversationIds: string[]) {
  if (!conversationIds.length) return new Map<string, MessageWithSender>();
  const rows = await db
    .selectFrom("messages as m")
    .innerJoin("users as sender", "sender.id", "m.sender_id")
    .select((eb) => [
      "m.id",
      "m.conversation_id",
      "m.sender_id",
      "m.body",
      "m.created_at",
      "m.read_at",
      eb.ref("sender.display_name").as("sender_display_name"),
      eb.ref("sender.email").as("sender_email"),
    ])
    .distinctOn("m.conversation_id")
    .where("m.conversation_id", "in", conversationIds)
    .orderBy("m.conversation_id")
    .orderBy("m.created_at", "desc")
    .orderBy("m.id", "desc")
    .execute();
  return new Map(rows.map((row) => [row.conversation_id, row]));
}

async function unreadCounts(db: Database, conversationIds: string[]) {
  if (!conversationIds.length) return new Map<string, number>();
  const rows = await db
    .selectFrom("messages as m")
    .innerJoin("conversations as c", "c.id", "m.conversation_id")
    .select((eb) => ["m.conversation_id", eb.fn.count("m.id").as("count")])
    .where("m.conversation_id", "in", conversationIds)
    .whereRef("m.sender_id", "=", "c.customer_id")
    .where("m.read_at", "is", null)
    .groupBy("m.conversation_id")
    .execute();
  return new Map(rows.map((row) => [row.conversation_id, Number(row.count)]));
}

export async function listConversations(db: Database) {
  const rows = await conversationColumns(db)
    .where(({ exists, selectFrom }) =>
      exists(
        selectFrom("messages as m")
          .select("m.id")
          .whereRef("m.conversation_id", "=", "c.id"),
      ),
    )
    .orderBy("c.updated_at", "desc")
    .execute();

  const ids = rows.map((row) => row.id);
  const [last, unread] = await Promise.all([lastMessages(db, ids), unreadCounts(db, ids)]);

  return rows.map((row) => {
    const latest = last.get(row.id);
    return conversationDto(
      row,
      latest ? messageDto(latest, row.customer_id) : null,
      unread.get(row.id) ?? 0,
    );
  });
}

export async function markRead(
  db: Database,
  conversation: ConversationWithCustomer,
  viewer: "admin" | "customer",
) {
  const query = db
    .updateTable("messages")
    .set({ read_at: new Date() })
    .where("conversation_id", "=", conversation.id)
    .where("read_at", "is", null);

  if (viewer === "admin") {
    await query.where("sender_id", "=", conversation.customer_id).execute();
  } else {
    await query.where("sender_id", "!=", conversation.customer_id).execute();
  }
}

export async function createMessage(
  db: Database,
  conversation: ConversationWithCustomer,
  senderId: string,
  body: string,
) {
  return db.transaction().execute(async (trx) => {
    const row = await trx
      .insertInto("messages")
      .values({ conversation_id: conversation.id, sender_id: senderId, body })
      .returningAll()
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("conversations")
      .set({ updated_at: row.created_at })
      .where("id", "=", conversation.id)
      .execute();
    const sender = await trx
      .selectFrom("users")
      .select(["display_name", "email"])
      .where("id", "=", senderId)
      .executeTakeFirstOrThrow();
    return messageDto(
      {
        ...row,
        sender_display_name: sender.display_name,
        sender_email: sender.email,
      },
      conversation.customer_id,
    );
  });
}
