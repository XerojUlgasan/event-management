import type { Insertable, Kysely, Transaction, Updateable } from "kysely";
import type { DB, EventChecklistItems, EventChecklists } from "../../db/types.js";

type Database = Kysely<DB> | Transaction<DB>;

// ─── Checklist ───────────────────────────────────────────────────────────────

export const findChecklistByBookingRequestData = (db: Database, bookingRequestId: string) =>
  db
    .selectFrom("event_checklists")
    .selectAll()
    .where("booking_request_id", "=", bookingRequestId)
    .executeTakeFirst();

export const createChecklistData = (
  db: Transaction<DB>,
  values: Insertable<EventChecklists>,
) =>
  db
    .insertInto("event_checklists")
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();

// ─── Checklist items ─────────────────────────────────────────────────────────

export const listChecklistItemsData = (db: Database, checklistId: string) =>
  db
    .selectFrom("event_checklist_items")
    .selectAll()
    .where("checklist_id", "=", checklistId)
    .orderBy("stage", "asc")
    .orderBy("sort_order", "asc")
    .orderBy("created_at", "asc")
    .execute();

export const createChecklistItemsData = (
  db: Transaction<DB>,
  values: Insertable<EventChecklistItems>[],
) =>
  db
    .insertInto("event_checklist_items")
    .values(values)
    .returningAll()
    .execute();

export const findChecklistItemData = (
  db: Database,
  checklistId: string,
  itemId: string,
) =>
  db
    .selectFrom("event_checklist_items")
    .selectAll()
    .where("checklist_id", "=", checklistId)
    .where("id", "=", itemId)
    .executeTakeFirst();

export const lockChecklistItemData = (
  db: Transaction<DB>,
  checklistId: string,
  itemId: string,
) =>
  db
    .selectFrom("event_checklist_items")
    .selectAll()
    .where("checklist_id", "=", checklistId)
    .where("id", "=", itemId)
    .forUpdate()
    .executeTakeFirst();

export const updateChecklistItemData = (
  db: Transaction<DB>,
  itemId: string,
  patch: Updateable<EventChecklistItems>,
) =>
  db
    .updateTable("event_checklist_items")
    .set({ ...patch, updated_at: new Date() })
    .where("id", "=", itemId)
    .returningAll()
    .executeTakeFirstOrThrow();
