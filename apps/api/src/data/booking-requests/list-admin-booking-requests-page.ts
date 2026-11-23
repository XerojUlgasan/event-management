import { selectSubmittedBookings } from "./select-submitted-bookings.js";
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "../../db/types.js";
import { keysetPredicate, utcTimestampSql } from "../../utils/sql-page.js";

type Database = Kysely<DB> | Transaction<DB>;

export const listAdminBookingRequestsPageData = (
  db: Database,
  input: {
    status?: string;
    preferredDate?: string;
    customerId?: string;
    position?: { submittedAt: string; id: string };
    limit: number;
  },
) => {
  let query = selectSubmittedBookings(db).select(
    utcTimestampSql("submitted_at").as("cursor_submitted_at"),
  );

  if (input.status) query = query.where("status", "=", input.status);

  if (input.customerId)
    query = query.where("customer_id", "=", input.customerId);

  if (input.preferredDate)
    query = query.where(sql<boolean>`(
    (requested_days IS NULL AND preferred_date = ${input.preferredDate}) OR
    EXISTS (SELECT 1 FROM jsonb_array_elements(requested_days) AS requested(day) WHERE day->>'date' = ${input.preferredDate})
  )`);

  if (input.position)
    query = query.where(
      keysetPredicate(
        "submitted_at",
        "id",
        input.position.submittedAt,
        input.position.id,
        "<",
      ),
    );

  return query
    .orderBy("submitted_at", "desc")
    .orderBy("id", "desc")
    .limit(input.limit + 1)
    .execute();
};
