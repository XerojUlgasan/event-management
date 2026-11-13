export const MAX_CHECKLIST_TITLE_LENGTH = 200;
export const MAX_CHECKLIST_TASKS = 100;
export const MAX_CHECKLIST_TEXT_LENGTH = 4000;

export type ChecklistTaskInput = {
  title: string;
  instructions: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "blocked" | "completed";
  note: string;
};
export type ChecklistTask = ChecklistTaskInput & { id: string; completedAt: string | null };
export type ChecklistOperation =
  | { kind: "title"; title: string }
  | { kind: "add"; task: ChecklistTaskInput }
  | { kind: "update"; taskId: string; task: ChecklistTaskInput }
  | { kind: "delete"; taskId: string }
  | { kind: "reorder"; taskIds: string[] };
export type EventChecklist = {
  id: string;
  eventDayId: string;
  title: string;
  content: { tasks: ChecklistTask[] };
  revision: number;
  coordinatorId: string | null;
  sentBy: string | null;
  sentAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};
