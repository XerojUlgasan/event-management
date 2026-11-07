import { z } from "@hono/zod-openapi";
import {
  CHECKLIST_STAGES,
  CHECKLIST_STATUSES,
  MAX_CHECKLIST_ACTIVITY_LENGTH,
  MAX_CHECKLIST_BLOCKER_NOTE_LENGTH,
  MAX_CHECKLIST_NOTE_LENGTH,
} from "@event-management/contracts/limits/checklists";

// ─── Shared params ───────────────────────────────────────────────────────────

export const bookingRequestIdParams = z.object({ bookingRequestId: z.string().uuid() });
export const itemParams = z.object({
  bookingRequestId: z.string().uuid(),
  itemId: z.string().uuid(),
});

// ─── Input schemas ───────────────────────────────────────────────────────────

export const createChecklistItemSchema = z.object({
  stage: z.enum(CHECKLIST_STAGES),
  sortOrder: z.number().int().min(0).optional(),
  activity: z.string().trim().min(1).max(MAX_CHECKLIST_ACTIVITY_LENGTH),
  plannedTime: z.string().trim().nullable().optional(),
});

export const createChecklistSchema = z.object({
  coordinatorId: z.string().uuid(),
  items: z.array(createChecklistItemSchema).min(1),
});

export const updateChecklistItemSchema = z.object({
  status: z.enum(CHECKLIST_STATUSES).optional(),
  actualTime: z.string().trim().nullable().optional(),
  blockerNote: z.string().trim().max(MAX_CHECKLIST_BLOCKER_NOTE_LENGTH).nullable().optional(),
  notes: z.string().trim().max(MAX_CHECKLIST_NOTE_LENGTH).nullable().optional(),
});

// ─── Response schemas ────────────────────────────────────────────────────────

export const checklistItemSchema = z.object({
  id: z.string().uuid(),
  checklistId: z.string().uuid(),
  stage: z.enum(CHECKLIST_STAGES),
  sortOrder: z.number().int(),
  activity: z.string(),
  plannedTime: z.string().nullable(),
  status: z.enum(CHECKLIST_STATUSES),
  actualTime: z.string().nullable(),
  blockerNote: z.string().nullable(),
  notes: z.string().nullable(),
  photoCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const checklistSchema = z.object({
  id: z.string().uuid(),
  bookingRequestId: z.string().uuid(),
  coordinatorId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(checklistItemSchema),
});
