import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { params, readResponse, tags } from "./schemas.js";
import { getEventChecklistService } from "../../services/event-checklists/get-event-checklist.js";
import { ChecklistError } from "../../services/event-checklists/event-checklists.js";

export const getEventChecklistRoute = createRoute({
  method: "get", path: "/admin/event-days/{id}/checklist", tags,
  request: { params },
  responses: readResponse,
});
export const getEventChecklistRouteHandler: AppRouteHandler<typeof getEventChecklistRoute> = async c => {
  try {
    const checklist = await getEventChecklistService(c.get("db"), c.req.valid("param").id, c.get("session").user);
    return c.json({ checklist }, 200);
  } catch (error) {
    if (error instanceof ChecklistError) return c.json({ error: error.message }, error.status);
    throw error;
  }
};
export const getEventChecklistStaffRoute = createRoute({
  method: "get", path: "/staff/event-days/{id}/checklist", tags,
  request: { params },
  responses: readResponse,
});
