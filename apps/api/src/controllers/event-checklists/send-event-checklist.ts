import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { body } from "../booking-requests/http.js";
import { params, response, tags, revision } from "./schemas.js";
import { updateEventChecklistService } from "../../services/event-checklists/update-event-checklist.js";
import { ChecklistError } from "../../services/event-checklists/event-checklists.js";

export const sendEventChecklistRoute = createRoute({
  method: "post", path: "/admin/event-days/{id}/checklist/send", tags,
  request: { params, body: body(z.strictObject({ expectedRevision: revision })) },
  responses: response,
});
export const sendEventChecklistRouteHandler: AppRouteHandler<typeof sendEventChecklistRoute> = async c => {
  try {
    const checklist = await updateEventChecklistService(c.get("db"), c.req.valid("param").id, c.get("session").user, c.req.valid("json").expectedRevision, { kind: "send" });
    return c.json({ checklist }, 200);
  } catch (error) {
    if (error instanceof ChecklistError) return c.json({ error: error.message }, error.status);
    throw error;
  }
};
