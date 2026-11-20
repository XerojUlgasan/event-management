import { guestIsActive } from "../guest-chat/activity.js";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";

export function findPrivateMessageImageData(db: Kysely<DB>, id: string) {
  return db
    .selectFrom("message_images as i")
    .innerJoin("messages as m", "m.id", "i.message_id")
    .innerJoin("conversations as c", "c.id", "m.conversation_id")
    .select([
      "i.storage_key",
      "i.mime_type",
      "i.byte_size",
      "i.interpretation",
      "c.customer_id",
      "c.guest_identity_id",
    ])
    .select(guestIsActive().as("guest_active"))
    .where("i.id", "=", id)
    .executeTakeFirst();
}

export async function ownsMessageImageGuestData(
  db: Kysely<DB>,
  identityId: string,
  tokenHash: string,
) {
  return !!(await db
    .selectFrom("guest_chat_identities")
    .select("id")
    .where("id", "=", identityId)
    .where("token_hash", "=", tokenHash)
    .executeTakeFirst());
}
