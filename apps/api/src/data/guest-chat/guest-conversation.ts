import { sql, type Kysely, type Transaction, type Selectable } from "kysely";
import type { Conversations, DB } from "../../db/types.js";
import {
  GUEST_CUSTOMER_MESSAGE_LIMIT,
  GUEST_INACTIVITY_TTL_MS,
  type GuestChatStatus,
} from "@event-management/contracts/guest-chat";
import { hashSessionToken } from "../../utils/session.js";

export type GuestDatabase = Kysely<DB>;
export type GuestConversation = Selectable<Conversations>;
export class GuestChatError extends Error {
  constructor(
    public status: 404 | 409 | 410,
    message: string,
    public code?: "login_required" | "guest_expired" | "request_conflict",
  ) {
    super(message);
  }
}
export function guestStatus(conversation: GuestConversation): GuestChatStatus {
  return {
    customerMessageCount: conversation.guest_customer_message_count,
    remainingMessages: Math.max(
      0,
      GUEST_CUSTOMER_MESSAGE_LIMIT - conversation.guest_customer_message_count,
    ),
    expiresAt: conversation.guest_expires_at!.toISOString(),
    loginRequired:
      conversation.guest_customer_message_count >= GUEST_CUSTOMER_MESSAGE_LIMIT,
  };
}
export function guestExpiry(now = new Date()) {
  return new Date(now.getTime() + GUEST_INACTIVITY_TTL_MS);
}
export function assertGuestActive(conversation: GuestConversation) {
  if (
    conversation.guest_expires_at &&
    conversation.guest_expires_at.getTime() <= Date.now()
  )
    throw new GuestChatError(
      410,
      "This guest conversation expired. Start a new chat.",
      "guest_expired",
    );
  if (conversation.status !== "active")
    throw new GuestChatError(409, "Conversation is closed");
}
export async function lockGuestConversation(
  trx: Transaction<DB>,
  id: string,
  token: string | undefined,
) {
  if (!token) throw new GuestChatError(404, "Conversation not found");
  const conversation = await trx
    .selectFrom("conversations")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();
  if (!conversation?.guest_identity_id || conversation.customer_id)
    throw new GuestChatError(404, "Conversation not found");
  const identity = await trx
    .selectFrom("guest_chat_identities")
    .select("id")
    .where("id", "=", conversation.guest_identity_id)
    .where("token_hash", "=", hashSessionToken(token))
    .executeTakeFirst();
  if (!identity) throw new GuestChatError(404, "Conversation not found");
  assertGuestActive(conversation);
  return conversation;
}
export async function bootstrapGuestConversationData(
  db: GuestDatabase,
  token: string,
) {
  return db.transaction().execute(async (trx) => {
    const hash = hashSessionToken(token);
    await trx
      .insertInto("guest_chat_identities")
      .values({ token_hash: hash })
      .onConflict((oc) => oc.column("token_hash").doNothing())
      .execute();
    const identity = await trx
      .selectFrom("guest_chat_identities")
      .select("id")
      .where("token_hash", "=", hash)
      .forUpdate()
      .executeTakeFirstOrThrow();
    const current = await trx
      .selectFrom("conversations")
      .selectAll()
      .where("guest_identity_id", "=", identity.id)
      .where("status", "=", "active")
      .forUpdate()
      .executeTakeFirst();
    if (current && current.guest_expires_at!.getTime() > Date.now())
      return current;
    if (current)
      await trx
        .updateTable("conversations")
        .set({ status: "closed", closed_at: sql`clock_timestamp()` })
        .where("id", "=", current.id)
        .execute();
    return trx
      .insertInto("conversations")
      .values({
        customer_id: null,
        guest_identity_id: identity.id,
        guest_expires_at: guestExpiry(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  });
}

/** A presented cookie is resumable only when its hash was issued by this API. */
export async function resolveGuestTokenData(
  db: GuestDatabase,
  token: string | undefined,
) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  return Boolean(
    await db
      .selectFrom("guest_chat_identities")
      .select("id")
      .where("token_hash", "=", hashSessionToken(token))
      .executeTakeFirst(),
  );
}
