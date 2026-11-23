import type { Kysely } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";

export function listNotificationsData(
  db: Kysely<DB>,
  userId: string,
  limit: number,
  cursor?: { createdAt: string; id: string },
) {
  const owned = db
    .selectFrom("notifications")
    .where("recipient_user_id", "=", userId);
  let page = owned
    .select(["id", "type", "payload", "source_event_id"])
    .select(utcTimestampSql("created_at").as("cursor_created_at"))
    .select(utcTimestampSql("read_at").$castTo<string | null>().as("read_at"))
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(limit + 1);

  if (cursor)
    page = page.where(
      keysetPredicate("created_at", "id", cursor.createdAt, cursor.id, "<"),
    );

  // The page and unread total come from the same database snapshot.
  return db
    .selectNoFrom([
      jsonArrayFrom(page).as("rows"),
      owned
        .where("read_at", "is", null)
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .as("unread_count"),
    ])
    .executeTakeFirstOrThrow();
}

export function listNotificationBookingsData(
  db: Kysely<DB>,
  ids: string[],
  viewer: { id: string; role: string },
) {
  if (ids.length === 0) return [];

  let query = db
    .selectFrom("booking_requests")
    .where("submitted_at", "is not", null)
    .select(["id", "event_type", "preferred_date"])
    .$narrowType<{ event_type: string; preferred_date: string }>()
    .where("id", "in", ids);

  if (viewer.role !== "admin")
    query = query.where("customer_id", "=", viewer.id);

  return query.execute();
}

export function listNotificationQuotationsData(
  db: Kysely<DB>,
  ids: string[],
  recipientId: string,
) {
  if (ids.length === 0) return [];

  return db
    .selectFrom("quotations")
    .innerJoin(
      "booking_requests",
      "booking_requests.id",
      "quotations.booking_request_id",
    )
    .innerJoin("messages", "messages.quotation_id", "quotations.id")
    .innerJoin("conversations", "conversations.id", "messages.conversation_id")
    .where("quotations.id", "in", ids)
    .where("quotations.status", "in", ["sent", "superseded"])
    .where("quotations.sent_at", "is not", null)
    .whereRef("conversations.booking_request_id", "=", "booking_requests.id")
    .where("conversations.customer_id", "=", recipientId)
    .where("booking_requests.customer_id", "=", recipientId)
    .where("booking_requests.submitted_at", "is not", null)
    .select([
      "quotations.id",
      "quotations.version",
      "conversations.id as conversation_id",
      "booking_requests.event_type",
      "booking_requests.preferred_date",
    ])
    .$narrowType<{ event_type: string; preferred_date: string }>()
    .execute();
}
