import {
  notificationContentSchema,
  type NotificationContent,
} from "@event-management/contracts/notifications";
import { sql, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";

export function createNotificationData(
  trx: Transaction<DB>,
  recipient: { userId: string } | { role: "admin" },
  sourceEventId: string,
  content: NotificationContent,
) {
  const { type, payload } = notificationContentSchema.parse(content);
  const users = trx.selectFrom("users");
  const recipients =
    "userId" in recipient
      ? users.where("id", "=", recipient.userId)
      : users.where("role", "=", recipient.role);

  return trx
    .insertInto("notifications")
    .columns(["recipient_user_id", "type", "source_event_id", "payload"])
    .expression(
      recipients.select([
        "id",
        sql<string>`${type}::text`.as("type"),
        sql<string>`${sourceEventId}::uuid`.as("source_event_id"),
        sql<string>`${JSON.stringify(payload)}::jsonb`.as("payload"),
      ]),
    )
    .onConflict((conflict) =>
      conflict
        .columns(["recipient_user_id", "type", "source_event_id"])
        .doNothing(),
    )
    .execute();
}
