import type { Kysely, Transaction } from "kysely";
import type { DB, BookingRequests } from "../../db/types.js";
import type { Insertable } from "kysely";
type Database = Kysely<DB> | Transaction<DB>;
export const findAvailableVersionData = (db: Transaction<DB>, packageId: string, versionId: string) => db.selectFrom("packages as p").innerJoin("package_versions as v", "v.package_id", "p.id").select(["v.id", "v.name", "v.guest_min", "v.guest_max"]).where("p.id", "=", packageId).where("v.id", "=", versionId).where("p.archived_at", "is", null).where("v.state", "=", "published").forUpdate().executeTakeFirst();
export const createBookingRequestData = (db: Transaction<DB>, values: Insertable<BookingRequests>) => db.insertInto("booking_requests").values(values).returningAll().executeTakeFirstOrThrow();
export const createBookingConversationData = async (db: Transaction<DB>, values: { customer_id: string; booking_request_id: string; package_id: string; event_type: string; event_starts_at: Date; event_ends_at: Date; guest_count: number; booking_reference: string; package_name: string }) => {
	const { booking_reference, package_name, ...conversationValues } = values;
	const conversation = await db.insertInto("conversations").values(conversationValues).returning("id").executeTakeFirstOrThrow();
	const now = new Date();
	await db.insertInto("messages").values({
		conversation_id: conversation.id,
		sender_id: null,
		sender_role: "assistant",
		body: `## Thanks for your booking request!\n\nYour request for **${package_name}** has been submitted and is now **waiting for staff approval**. Your reference is **${booking_reference}**.\n\nWhile you wait, you can ask me anything about your event, package details, or next steps. You can also ask to speak with a staff member at any time.`,
		read_at: now,
		created_at: now,
	}).execute();
};
export const addStatusHistoryData = (db: Transaction<DB>, bookingRequestId: string, status: string, changedBy: string, reason: string | null) => db.insertInto("booking_request_status_history").values({ booking_request_id: bookingRequestId, status, changed_by: changedBy, reason }).execute();
export const lockBookingRequestData = (db: Transaction<DB>, id: string) => db.selectFrom("booking_requests").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
export const updateBookingStatusData = (db: Transaction<DB>, id: string, status: string) => db.updateTable("booking_requests").set({ status, updated_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
export const listBookingRequestsData = (db: Database, customerId?: string) => { let query = db.selectFrom("booking_requests").selectAll(); if (customerId) query = query.where("customer_id", "=", customerId); return query.orderBy("created_at", "desc").orderBy("id", "desc").execute(); };
export const listStatusHistoryData = (db: Database, ids: string[]) => ids.length ? db.selectFrom("booking_request_status_history").selectAll().where("booking_request_id", "in", ids).orderBy("created_at", "asc").orderBy("id", "asc").execute() : Promise.resolve([]);
