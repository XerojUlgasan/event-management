import { z } from "@hono/zod-openapi";
import {
  MAX_CHECKLIST_TASKS,
  MAX_CHECKLIST_TEXT_LENGTH,
  MAX_CHECKLIST_TITLE_LENGTH,
} from "@event-management/contracts/event-checklists";
import { json, errors } from "../booking-requests/http.js";

// PostgreSQL text/JSONB rejects NUL and unpaired UTF-16 surrogates.
const validText = (value: string) => !/[\u0000\uD800-\uDFFF]/u.test(value);
export const title = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CHECKLIST_TITLE_LENGTH)
  .refine(validText, "Enter valid text without NUL characters");
const instant = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => Number(value.slice(0, 4)) > 0,
    "Use a year from 0001 to 9999",
  );
export const taskInput = z
  .strictObject({
    title,
    instructions: z
      .string()
      .max(MAX_CHECKLIST_TEXT_LENGTH)
      .refine(validText, "Enter valid text without NUL characters"),
    startsAt: instant,
    endsAt: instant,
    status: z.enum(["pending", "blocked", "completed"]),
    note: z
      .string()
      .max(MAX_CHECKLIST_TEXT_LENGTH)
      .refine(validText, "Enter valid text without NUL characters"),
  })
  .superRefine((task, ctx) => {
    if (Date.parse(task.endsAt) <= Date.parse(task.startsAt))
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Finish must be after start",
      });
    if (task.status === "blocked" && !task.note.trim())
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "A blocked task needs a concern note",
      });
  });
export const task = taskInput
  .safeExtend({ id: z.uuid(), completedAt: instant.nullable() })
  .superRefine((value, ctx) => {
    if ((value.status === "completed") !== (value.completedAt !== null))
      ctx.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Completion timestamp must match task status",
      });
  });
export const content = z
  .strictObject({ tasks: z.array(task).max(MAX_CHECKLIST_TASKS) })
  .superRefine((value, ctx) => {
    if (
      new Set(value.tasks.map((task) => task.id.toLowerCase())).size !==
      value.tasks.length
    )
      ctx.addIssue({ code: "custom", message: "Task IDs must be unique" });
  });
export const operation = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("title"), title }),
  z.strictObject({ kind: z.literal("add"), task: taskInput }),
  z.strictObject({
    kind: z.literal("update"),
    taskId: z.uuid(),
    task: taskInput,
  }),
  z.strictObject({ kind: z.literal("delete"), taskId: z.uuid() }),
  z.strictObject({
    kind: z.literal("reorder"),
    taskIds: z.array(z.uuid()).max(MAX_CHECKLIST_TASKS),
  }),
]);
export const revision = z.number().int().positive().max(2147483646);
export const params = z.object({ id: z.uuid() });
export const dto = z.object({
  id: z.uuid(),
  eventDayId: z.uuid(),
  title,
  content,
  revision: z.number().int(),
  coordinatorId: z.uuid().nullable(),
  sentBy: z.uuid().nullable(),
  sentAt: instant.nullable(),
  createdBy: z.uuid(),
  updatedBy: z.uuid(),
  createdAt: instant,
  updatedAt: instant,
});
export const response = {
  200: {
    content: json(z.object({ checklist: dto })),
    description: "Saved event-day checklist",
  },
  ...errors,
};
export const readResponse = {
  200: {
    content: json(z.object({ checklist: dto.nullable() })),
    description: "Checklist, or no checklist yet",
  },
  ...errors,
};
export const tags = ["Event checklists"];
