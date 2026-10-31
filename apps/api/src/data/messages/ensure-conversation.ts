import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

import { selectConversationColumnsData } from "./select-conversation-columns.js";

type Database = Kysely<DB>;

export async function ensureConversationData(db: Database, customerId: string) {
  const existing = await selectConversationColumnsData(db)
    .where("c.customer_id", "=", customerId)
    .orderBy("c.created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (existing) return existing;
  await db.insertInto("conversations").values({ customer_id: customerId }).execute();
  return selectConversationColumnsData(db)
    .where("c.customer_id", "=", customerId)
    .orderBy("c.created_at", "desc")
    .executeTakeFirstOrThrow();
}

export async function ensureUnboundConversationData(db: Database, customerId: string) {
  const existing = await selectConversationColumnsData(db)
    .where("c.customer_id", "=", customerId)
    .where("c.booking_request_id", "is", null)
    .orderBy("c.created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  if (existing) return existing;
  await db.insertInto("conversations").values({ customer_id: customerId }).execute();
  return selectConversationColumnsData(db)
    .where("c.customer_id", "=", customerId)
    .where("c.booking_request_id", "is", null)
    .orderBy("c.created_at", "desc")
    .executeTakeFirstOrThrow();
}

export async function findGuestConversationData(db: Database, customerId: string, guestChatId: string) {
  return selectConversationColumnsData(db)
    .where("c.customer_id", "=", customerId)
    .where("c.guest_chat_id", "=", guestChatId)
    .executeTakeFirst();
}
