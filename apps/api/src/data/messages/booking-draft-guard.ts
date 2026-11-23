import type { Kysely, Transaction } from "kysely";
import { bookingDraftFieldsSchema } from "@event-management/contracts/booking-draft";
import { MAX_SPECIAL_REQUESTS_LENGTH } from "@event-management/contracts/limits/booking-requests";
import { requestedDaysSchema } from "../../controllers/booking-requests/schemas.js";
import type { DB } from "../../db/types.js";
import { bookingRevision } from "../booking-requests/booking-revision.js";
import {
  readConversationMemoryData,
  type ConversationMemoryScope,
} from "./conversation-memory.js";
import { assertImageMessageJobLeaseData } from "./message-processing.js";

export type BookingDraftScope = ConversationMemoryScope & {
  expectedRevision: string | null;
};

export async function guardBookingDraftData(
  db: Transaction<DB>,
  scope: BookingDraftScope,
  abortSignal?: AbortSignal,
) {
  abortSignal?.throwIfAborted();
  const conversation = await db
    .selectFrom("conversations")
    .select(["id", "customer_id", "booking_request_id", "guest_identity_id"])
    .where("id", "=", scope.conversationId)
    .forUpdate()
    .executeTakeFirst();

  if (!conversation) return null;

  // A guest capability must not inherit the customer's authority after claim.
  if (
    scope.guestIdentityId &&
    conversation.guest_identity_id !== scope.guestIdentityId
  )
    return null;

  // Recheck after acquiring the lock, since another sender or AI toggle may
  // have committed while this operation was waiting.
  if (!(await readConversationMemoryData(db, scope))) return null;

  if (scope.guestIdentityId) {
    const origin = await db
      .selectFrom("messages")
      .select("id")
      .where("id", "=", scope.customerMessageId)
      .where("guest_origin", "=", true)
      .executeTakeFirst();

    if (!origin) return null;
  }

  if (scope.jobLease)
    await assertImageMessageJobLeaseData(db, scope.jobLease, abortSignal);

  abortSignal?.throwIfAborted();

  return conversation;
}

export async function readBookingDraftData(
  db: Kysely<DB>,
  conversationId: string,
) {
  const row = await db
    .selectFrom("booking_requests")
    .select([
      "id",
      "event_type",
      "duration_mode",
      "requested_days",
      "time_zone",
      "guest_count",
      "contact_name",
      "phone_number",
      "preferred_venue_location",
      "special_requests",
      "package_id",
      "budget",
      "requested_services",
    ])
    .select(bookingRevision.as("revision"))
    .where(
      "id",
      "=",
      db
        .selectFrom("conversations")
        .select("booking_request_id")
        .where("id", "=", conversationId),
    )
    .where("submitted_at", "is", null)
    .executeTakeFirst();

  if (!row) return null;

  const notes = row.special_requests ?? undefined;
  const legacyNotes = notes && notes.length > MAX_SPECIAL_REQUESTS_LENGTH;

  const fields = bookingDraftFieldsSchema.parse({
    eventType: row.event_type ?? undefined,
    durationMode: row.duration_mode ?? undefined,
    requestedDates: row.requested_days
      ? requestedDaysSchema.parse(row.requested_days).map((day) => day.date)
      : undefined,
    timeZone: row.time_zone ?? undefined,
    guestCount: row.guest_count ?? undefined,
    contactName: row.contact_name ?? undefined,
    phoneNumber: row.phone_number ?? undefined,
    preferredVenueLocation: row.preferred_venue_location ?? undefined,
    specialRequests: legacyNotes ? undefined : notes,
    packageId: row.package_id ?? undefined,
    budget: row.budget ?? undefined,
    requestedServices: row.requested_services ?? undefined,
  });

  // Migration merges the old draft's two note fields without dropping text.
  if (legacyNotes) fields.specialRequests = notes;

  return { id: row.id, revision: row.revision, fields };
}
