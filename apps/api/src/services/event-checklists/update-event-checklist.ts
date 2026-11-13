import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { checklistContext, checklistDto, fail, type Actor } from "./event-checklists.js";
import { randomUUID } from "node:crypto";
import type { ChecklistOperation, ChecklistTask } from "@event-management/contracts/event-checklists";
import { content } from "../../controllers/event-checklists/schemas.js";
import { saveEventChecklistData } from "../../data/event-checklists/save-event-checklist.js";

export function updateEventChecklistService(db: Kysely<DB>, id: string, actor: Actor, expectedRevision: number, operation: ChecklistOperation | { kind: "send" }) {
  return db.transaction().execute(async trx => {
    const { row, coordinator, admin } = await checklistContext(trx, id, actor, true);
    if (!row) return fail("Checklist not found", 404);
    if (!admin && (operation.kind === "title" || operation.kind === "send")) return fail("Admin access required", 403);
    if (row.revision !== expectedRevision) return fail("This checklist changed. Reload it before saving again.", 409);
    const document = content.parse(row.content);
    let tasks: ChecklistTask[] = document.tasks;
    let title = row.title;
    const completion = (status: ChecklistTask["status"], previous?: ChecklistTask) => status === "completed" ? previous?.completedAt ?? new Date().toISOString() : null;
    switch (operation.kind) {
      case "title": title = operation.title; break;
      case "send":
        if (!tasks.length) return fail("Add at least one task before sending", 409);
        if (!coordinator) return fail("Confirm a coordinator for this event day before sending", 409);
        break;
      case "add": tasks = [...tasks, { ...operation.task, id: randomUUID(), completedAt: completion(operation.task.status) }]; break;
      case "update": {
        const previous = tasks.find(task => task.id === operation.taskId);
        if (!previous) return fail("Task not found", 404);
        tasks = tasks.map(task => task.id === operation.taskId ? { ...operation.task, id: task.id, completedAt: completion(operation.task.status, task) } : task);
        break;
      }
      case "delete":
        if (!tasks.some(task => task.id === operation.taskId)) return fail("Task not found", 404);
        tasks = tasks.filter(task => task.id !== operation.taskId); break;
      case "reorder": {
        if (operation.taskIds.length !== tasks.length || new Set(operation.taskIds).size !== tasks.length) return fail("Supply each task ID exactly once", 400);
        const ordered: ChecklistTask[] = [];
        for (const taskId of operation.taskIds) {
          const task = tasks.find(task => task.id === taskId);
          if (!task) return fail("Supply each task ID exactly once", 400);
          ordered.push(task);
        }
        tasks = ordered; break;
      }
    }
    const parsed = content.safeParse({ tasks });
    if (!parsed.success) return fail(parsed.error.issues.map(issue => issue.message).join("; "), 400);
    const updated = await saveEventChecklistData(trx, row.id, expectedRevision, actor.id, {
      title, content: JSON.stringify(parsed.data),
      coordinator_id: operation.kind === "send" ? coordinator?.staff_id ?? fail("Confirm a coordinator before sending", 409) : row.coordinator_id,
      sent_by: operation.kind === "send" ? actor.id : row.sent_by,
      sent_at: operation.kind === "send" ? new Date() : row.sent_at,
    });
    if (!updated) return fail("This checklist changed. Reload it before saving again.", 409);
    return checklistDto(updated);
  });
}
