import { type Kysely, type Transaction, type Selectable } from "kysely";
import type { Conversations, DB } from "../../db/types.js";
import {
  GUEST_CUSTOMER_MESSAGE_LIMIT,
  GUEST_INACTIVITY_TTL_MS,
  type GuestChatStatus,
} from "@event-management/contracts/guest-chat";
import {
  guestIsActive,
  conversationActivity,
  withConversationActivity,
} from "./activity.js";
import { hashSessionToken } from "../../utils/session.js";

export type GuestDatabase = Kysely<DB>;

export type GuestConversation = Selectable<Conversations> & {
  last_activity_at: Date;
};

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
    expiresAt: guestExpiry(conversation.last_activity_at).toISOString(),
    loginRequired:
      conversation.guest_customer_message_count >= GUEST_CUSTOMER_MESSAGE_LIMIT,
  };
}

export function guestExpiry(now = new Date()) {
  return new Date(now.getTime() + GUEST_INACTIVITY_TTL_MS);
}

export function assertGuestActive(conversation: GuestConversation) {
  if (guestExpiry(conversation.last_activity_at).getTime() <= Date.now())
    throw new GuestChatError(
      410,
      "This guest conversation expired. Start a new chat.",
      "guest_expired",
    );
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

  const enriched = await withConversationActivity(trx, conversation);
  assertGuestActive(enriched);

  return enriched;
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
    // Lock existing rows first, then read activity using a fresh statement snapshot.
    await trx
      .selectFrom("conversations")
      .select("id")
      .where("guest_identity_id", "=", identity.id)
      .forUpdate()
      .execute();
    const current = await trx
      .selectFrom("conversations as c")
      .selectAll("c")
      .select(conversationActivity().as("last_activity_at"))
      .where("c.guest_identity_id", "=", identity.id)
      .where(guestIsActive())
      .orderBy(conversationActivity(), "desc")
      .orderBy("c.id", "desc")
      .executeTakeFirst();

    if (current) return current;

    const created = await trx
      .insertInto("conversations")
      .values({ customer_id: null, guest_identity_id: identity.id })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...created, last_activity_at: created.created_at };
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
