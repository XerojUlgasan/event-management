import { nextBookingRevision } from "../booking-requests/booking-revision.js";
import { withConversationActivity } from "./activity.js";
import { hashSessionToken } from "../../utils/session.js";
import {
  assertGuestActive,
  GuestChatError,
  type GuestDatabase,
} from "./guest-conversation.js";

export function claimGuestConversationData(
  db: GuestDatabase,
  id: string,
  token: string | undefined,
  customerId: string,
) {
  return db.transaction().execute(async (trx) => {
    if (!token) throw new GuestChatError(404, "Conversation not found");

    const conversation = await trx
      .selectFrom("conversations")
      .selectAll()
      .where("id", "=", id)
      .forUpdate()
      .executeTakeFirst();

    if (!conversation) throw new GuestChatError(404, "Conversation not found");

    const identityId =
      conversation.guest_identity_id ?? conversation.claimed_guest_identity_id;
    const identity = identityId
      ? await trx
          .selectFrom("guest_chat_identities")
          .select("id")
          .where("id", "=", identityId)
          .where("token_hash", "=", hashSessionToken(token))
          .executeTakeFirst()
      : null;

    if (!identity) throw new GuestChatError(404, "Conversation not found");

    if (conversation.customer_id) {
      if (
        conversation.customer_id !== customerId ||
        !conversation.claimed_guest_identity_id
      )
        throw new GuestChatError(404, "Conversation not found");

      return { conversationId: id };
    }

    assertGuestActive(await withConversationActivity(trx, conversation));
    await trx
      .updateTable("conversations")
      .set({
        customer_id: customerId,
        claimed_guest_identity_id: identity.id,
        guest_identity_id: null,
      })
      .where("id", "=", id)
      .execute();

    if (conversation.booking_request_id)
      await trx
        .updateTable("booking_requests")
        .set({ customer_id: customerId, updated_at: nextBookingRevision })
        .where("id", "=", conversation.booking_request_id)
        .where("submitted_at", "is", null)
        .where("customer_id", "is", null)
        .returning("id")
        .executeTakeFirstOrThrow();

    // Guest human messages retain their original provenance and NULL sender IDs.
    return { conversationId: id };
  });
}
