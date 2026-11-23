import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";

type Database = Kysely<DB> | Transaction<DB>;

export const listCustomPackageHistoryData = (
  db: Database,
  bookingId: string,
  input: { limit: number; position?: { createdAt: string; id: string } },
) => {
  let query = db
    .selectFrom("audit_events as audit")
    .leftJoin("users as actor", "actor.id", "audit.actor_id")
    .select([
      "audit.id",
      "audit.actor_id",
      "actor.display_name as actor_name",
      "audit.action",
      "audit.metadata",
      "audit.created_at",
    ])
    .select(utcTimestampSql("audit.created_at").as("cursor_created_at"))
    .where("audit.entity_type", "=", "booking_request")
    .where("audit.entity_id", "=", bookingId)
    .where("audit.action", "in", [
      "booking.custom_package_created",
      "booking.custom_package_updated",
    ]);

  if (input.position)
    query = query.where(
      keysetPredicate(
        "audit.created_at",
        "audit.id",
        input.position.createdAt,
        input.position.id,
        "<",
      ),
    );

  return query
    .orderBy("audit.created_at", "desc")
    .orderBy("audit.id", "desc")
    .limit(input.limit + 1)
    .execute();
};
