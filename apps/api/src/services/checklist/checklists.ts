import type { Kysely, Selectable } from "kysely";
import type { DB, EventChecklistItems, EventChecklists } from "../../db/types.js";
import type { ChecklistStage, ChecklistStatus } from "@event-management/contracts/limits/checklists";
import {
  findChecklistByBookingRequestData,
  createChecklistData,
  createChecklistItemsData,
  listChecklistItemsData,
  lockChecklistItemData,
  updateChecklistItemData,
} from "../../data/checklist/checklists.js";

const error = (message: string, status: 400 | 403 | 404 | 409) => ({ message, status });

// ─── Response mappers ────────────────────────────────────────────────────────

function mapItem(row: Selectable<EventChecklistItems>) {
  return {
    id: row.id,
    checklistId: row.checklist_id,
    stage: row.stage as ChecklistStage,
    sortOrder: row.sort_order,
    activity: row.activity,
    plannedTime: row.planned_time,
    status: row.status as ChecklistStatus,
    actualTime: row.actual_time,
    blockerNote: row.blocker_note,
    notes: row.notes,
    photoCount: row.photo_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapChecklist(
  row: Selectable<EventChecklists>,
  items: Selectable<EventChecklistItems>[],
) {
  return {
    id: row.id,
    bookingRequestId: row.booking_request_id,
    coordinatorId: row.coordinator_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    items: items.map(mapItem),
  };
}

// ─── Input types ─────────────────────────────────────────────────────────────

export type CreateChecklistItemInput = {
  stage: ChecklistStage;
  sortOrder?: number;
  activity: string;
  plannedTime?: string | null;
};

export type CreateChecklistInput = {
  bookingRequestId: string;
  coordinatorId: string;
  items: CreateChecklistItemInput[];
};

export type UpdateChecklistItemInput = {
  status?: ChecklistStatus;
  actualTime?: string | null;
  blockerNote?: string | null;
  notes?: string | null;
};

// ─── Services ────────────────────────────────────────────────────────────────

export async function createChecklistService(
  db: Kysely<DB>,
  input: CreateChecklistInput,
) {
  return db.transaction().execute(async (trx) => {
    const existing = await findChecklistByBookingRequestData(trx, input.bookingRequestId);
    if (existing) return error("A checklist already exists for this booking request", 409);

    const checklist = await createChecklistData(trx, {
      booking_request_id: input.bookingRequestId,
      coordinator_id: input.coordinatorId,
    });

    const itemRows = await createChecklistItemsData(
      trx,
      input.items.map((item, idx) => ({
        checklist_id: checklist.id,
        stage: item.stage,
        sort_order: item.sortOrder ?? idx,
        activity: item.activity,
        planned_time: item.plannedTime ?? null,
      })),
    );

    return mapChecklist(checklist, itemRows);
  });
}

export async function getChecklistService(
  db: Kysely<DB>,
  bookingRequestId: string,
) {
  const checklist = await findChecklistByBookingRequestData(db, bookingRequestId);
  if (!checklist) return null;

  const items = await listChecklistItemsData(db, checklist.id);
  return mapChecklist(checklist, items);
}

export async function updateChecklistItemService(
  db: Kysely<DB>,
  checklistId: string,
  itemId: string,
  input: UpdateChecklistItemInput,
) {
  return db.transaction().execute(async (trx) => {
    const item = await lockChecklistItemData(trx, checklistId, itemId);
    if (!item) return error("Checklist item not found", 404);

    const updated = await updateChecklistItemData(trx, itemId, {
      ...(input.status !== undefined && { status: input.status }),
      ...(input.actualTime !== undefined && { actual_time: input.actualTime }),
      ...(input.blockerNote !== undefined && { blocker_note: input.blockerNote }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });

    return mapItem(updated);
  });
}
