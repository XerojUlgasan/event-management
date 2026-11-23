import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";

type Database = Kysely<DB> | Transaction<DB>;

export function listStatusHistoryData(
  db: Database,
  bookingId: string,
  input: {
    limit: number;
    position?: { createdAt: string; id: string };
    order: "asc" | "desc";
  },
) {
  let query = db
    .selectFrom("booking_request_status_history")
    .selectAll()
    .select(
      utcTimestampSql("created_at").as("cursor_created_at"),
    )
    .where("booking_request_id", "=", bookingId);

  if (input.position)
    query = query.where(
      keysetPredicate(
        "created_at",
        "id",
        input.position.createdAt,
        input.position.id,
        input.order === "desc" ? "<" : ">",
      ),
    );

  return query
    .orderBy("created_at", input.order)
    .orderBy("id", input.order)
    .limit(input.limit + 1)
    .execute();
}

export function latestStatusHistoryData(db: Database, bookingId: string) {
  return db
    .selectFrom("booking_request_status_history")
    .selectAll()
    .where("booking_request_id", "=", bookingId)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .limit(1)
    .executeTakeFirst();
}
