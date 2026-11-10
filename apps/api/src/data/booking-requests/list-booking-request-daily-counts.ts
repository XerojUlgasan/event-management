import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../db/types.js";
type Database = Kysely<DB> | Transaction<DB>;

export const listBookingRequestDailyCountsData = (
  db: Database,
  month: string,
  status?: string,
) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const nextMonth =
    monthNumber === 12
      ? `${String(year + 1).padStart(4, "0")}-01`
      : `${year.toString().padStart(4, "0")}-${String(monthNumber + 1).padStart(2, "0")}`;
  let query = db
    .selectFrom("booking_requests")
    .select("preferred_date")
    .select(db.fn.countAll<string>().as("count"))
    .where("preferred_date", ">=", `${month}-01`);
  if (month !== "9999-12")
    query = query.where("preferred_date", "<", `${nextMonth}-01`);
  if (status) query = query.where("status", "=", status);
  return query
    .groupBy("preferred_date")
    .orderBy("preferred_date", "asc")
    .execute();
};
