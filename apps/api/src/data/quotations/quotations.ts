import type { Insertable, Kysely, Transaction, Updateable } from "kysely";
import type { DB, QuotationItems, Quotations } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

export const listQuotationsData = (db: Database, bookingRequestId: string) =>
  db.selectFrom("quotations").selectAll().where("booking_request_id", "=", bookingRequestId).orderBy("version", "desc").execute();

export const findQuotationData = (db: Database, id: string) =>
  db.selectFrom("quotations").selectAll().where("id", "=", id).executeTakeFirst();

export const lockQuotationData = (db: Transaction<DB>, id: string) =>
  db.selectFrom("quotations").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();

export const nextQuotationVersionData = async (db: Transaction<DB>, bookingRequestId: string) => {
  const row = await db.selectFrom("quotations").select(({ fn }) => fn.max("version").as("version")).where("booking_request_id", "=", bookingRequestId).executeTakeFirst();
  return Number(row?.version ?? 0) + 1;
};

export const createQuotationData = (db: Transaction<DB>, values: Insertable<Quotations>) =>
  db.insertInto("quotations").values(values).returningAll().executeTakeFirstOrThrow();

export const updateQuotationData = (db: Transaction<DB>, id: string, values: Updateable<Quotations>) =>
  db.updateTable("quotations").set(values).where("id", "=", id).returningAll().executeTakeFirstOrThrow();

export const listQuotationItemsData = (db: Database, quotationIds: string[]) =>
  quotationIds.length
    ? db.selectFrom("quotation_items").selectAll().where("quotation_id", "in", quotationIds).orderBy("quotation_id").orderBy("sort_order").execute()
    : Promise.resolve([] as QuotationItems[]);

export const replaceQuotationItemsData = async (db: Transaction<DB>, quotationId: string, items: Insertable<QuotationItems>[]) => {
  await db.deleteFrom("quotation_items").where("quotation_id", "=", quotationId).execute();
  if (items.length) await db.insertInto("quotation_items").values(items).execute();
};

export const findBookingForQuotationData = (db: Database, quotationId: string) =>
  db.selectFrom("quotations as q").innerJoin("booking_requests as br", "br.id", "q.booking_request_id").select(["q.id", "q.booking_request_id", "q.status", "br.customer_id", "br.status as booking_status"]).where("q.id", "=", quotationId).executeTakeFirst();

export const findBookingData = (db: Database, bookingRequestId: string) =>
  db.selectFrom("booking_requests").select(["id", "customer_id", "status"]).where("id", "=", bookingRequestId).executeTakeFirst();
