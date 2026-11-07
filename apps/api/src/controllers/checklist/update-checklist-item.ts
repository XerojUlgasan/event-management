import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  getChecklistService,
  updateChecklistItemService,
} from "../../services/checklist/checklists.js";
import { checklistItemSchema, itemParams, updateChecklistItemSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const updateChecklistItemRoute = createRoute({
  method: "patch",
  path: "/checklists/{bookingRequestId}/items/{itemId}",
  tags: ["Checklists"],
  request: {
    params: itemParams,
    body: body(updateChecklistItemSchema),
  },
  responses: {
    200: { content: json(z.object({ item: checklistItemSchema })), description: "Item updated" },
    ...errors,
  },
});

export const updateChecklistItemRouteHandler: AppRouteHandler<typeof updateChecklistItemRoute> = async (c) => {
  const { bookingRequestId, itemId } = c.req.valid("param");

  // Resolve the checklist id from the booking request to scope the item lookup.
  const checklist = await getChecklistService(c.get("db"), bookingRequestId);
  if (!checklist) return c.json({ error: "Checklist not found" }, 404);

  const input = c.req.valid("json");
  const result = await updateChecklistItemService(c.get("db"), checklist.id, itemId, input);
  if ("message" in result) return c.json({ error: result.message }, result.status);
  return c.json({ item: result }, 200);
};
