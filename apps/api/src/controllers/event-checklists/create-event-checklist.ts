import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { params, response, tags, title } from "./schemas.js";
import { createEventChecklistService } from "../../services/event-checklists/create-event-checklist.js";
import { ChecklistError } from "../../services/event-checklists/event-checklists.js";

export const createEventChecklistRoute = createRoute({
  method: "post",
  path: "/admin/event-days/{id}/checklist",
  tags,
  request: { params, body: body(z.strictObject({ title })) },
  responses: {
    ...errors,
    201: { ...response[200], description: "Private draft created" },
  },
});
export const createEventChecklistRouteHandler: AppRouteHandler<
  typeof createEventChecklistRoute
> = async (c) => {
  try {
    const checklist = await createEventChecklistService(
      c.get("db"),
      c.req.valid("param").id,
      c.get("session").user,
      c.req.valid("json").title,
    );
    return c.json({ checklist }, 201);
  } catch (error) {
    if (error instanceof ChecklistError)
      return c.json({ error: error.message }, error.status);
    throw error;
  }
};
