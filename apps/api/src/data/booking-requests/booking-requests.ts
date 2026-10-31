import { sql, type Kysely, type Transaction } from "kysely";
import type { DB, BookingRequests } from "../../db/types.js";
import type { Insertable } from "kysely";
type Database = Kysely<DB> | Transaction<DB>;
export const findAvailableVersionData = (db: Transaction<DB>, packageId: string, versionId: string) => db.selectFrom("packages as p").innerJoin("package_versions as v", "v.package_id", "p.id").select(["v.id", "v.name", "v.guest_min", "v.guest_max"]).where("p.id", "=", packageId).where("v.id", "=", versionId).where("p.archived_at", "is", null).where("v.state", "=", "published").forUpdate().executeTakeFirst();
export const createBookingRequestData = (db: Transaction<DB>, values: Insertable<BookingRequests>) => db.insertInto("booking_requests").values(values).returningAll().executeTakeFirstOrThrow();
export const createBookingConversationData = (db: Transaction<DB>, values: { customer_id: string; booking_request_id: string; package_id: string; event_type: string; event_starts_at: Date | null; event_ends_at: Date | null; guest_count: number }) => db.insertInto("conversations").values(values).execute();
export const addStatusHistoryData = (db: Transaction<DB>, bookingRequestId: string, status: string, changedBy: string, reason: string | null) => db.insertInto("booking_request_status_history").values({ booking_request_id: bookingRequestId, status, changed_by: changedBy, reason }).execute();
export const lockBookingRequestData = (db: Transaction<DB>, id: string) => db.selectFrom("booking_requests").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
export const updateBookingStatusData = (db: Transaction<DB>, id: string, status: string) => db.updateTable("booking_requests").set({ status, updated_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
export const listBookingRequestsData = (db: Database, customerId?: string) => { let query = db.selectFrom("booking_requests").selectAll(); if (customerId) query = query.where("customer_id", "=", customerId); return query.orderBy("created_at", "desc").orderBy("id", "desc").execute(); };
export const listAdminBookingRequestsPageData = (db: Database, input: { status?: string; preferredDate?: string; cursor?: string; limit: number }) => {
  let query = db.selectFrom("booking_requests").selectAll();
  if (input.status) query = query.where("status", "=", input.status);
  if (input.preferredDate) query = query.where("preferred_date", "=", input.preferredDate);
  if (input.cursor) query = query.where(sql<boolean>`(created_at, id) < (select created_at, id from booking_requests where id = ${input.cursor}::uuid)`);
  return query.orderBy("created_at", "desc").orderBy("id", "desc").limit(input.limit + 1).execute();
};
export const listBookingRequestDailyCountsData = (db: Database, month: string, status?: string) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const nextMonth = monthNumber === 12 ? `${String(year + 1).padStart(4, "0")}-01` : `${year.toString().padStart(4, "0")}-${String(monthNumber + 1).padStart(2, "0")}`;
  let query = db.selectFrom("booking_requests").select("preferred_date").select(db.fn.countAll<string>().as("count"))
    .where("preferred_date", ">=", `${month}-01`);
  if (month !== "9999-12") query = query.where("preferred_date", "<", `${nextMonth}-01`);
  if (status) query = query.where("status", "=", status);
  return query.groupBy("preferred_date").orderBy("preferred_date", "asc").execute();
};
export const listStatusHistoryData = (db: Database, ids: string[]) => ids.length ? db.selectFrom("booking_request_status_history").selectAll().where("booking_request_id", "in", ids).orderBy("created_at", "asc").orderBy("id", "asc").execute() : Promise.resolve([]);
