import type { ChecklistOperation, EventChecklist } from "@event-management/contracts/event-checklists";
import { request } from "../http";
const path = (id: string, admin: boolean) => `/${admin ? "admin" : "staff"}/event-days/${encodeURIComponent(id)}/checklist`;
export const getEventChecklist = (id: string, admin: boolean) => request<{ checklist: EventChecklist | null }>(path(id, admin));
export const createEventChecklist = (id: string, title: string) => request<{ checklist: EventChecklist }>(path(id, true), { title });
export const updateEventChecklist = (id: string, admin: boolean, expectedRevision: number, operation: ChecklistOperation) =>
  request<{ checklist: EventChecklist }>(path(id, admin), { expectedRevision, operation }, undefined, "PATCH");
export const sendEventChecklist = (id: string, expectedRevision: number) => request<{ checklist: EventChecklist }>(`${path(id, true)}/send`, { expectedRevision });
