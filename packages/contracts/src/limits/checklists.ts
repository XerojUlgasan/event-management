export const CHECKLIST_STAGES = [
  "Preparation & packing",
  "Travel & arrival",
  "Venue setup",
  "Final readiness",
  "Event proper",
  "Cleanup & closeout",
] as const;

export type ChecklistStage = (typeof CHECKLIST_STAGES)[number];

export const CHECKLIST_STATUSES = ["todo", "done", "blocked"] as const;

export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export const MAX_CHECKLIST_ACTIVITY_LENGTH = 200;
export const MAX_CHECKLIST_NOTE_LENGTH = 400;
export const MAX_CHECKLIST_BLOCKER_NOTE_LENGTH = 400;
