import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { getChecklistService } from "../../services/checklist/checklists.js";
import { checklistSchema, bookingRequestIdParams } from "./schemas.js";
import { errors, json } from "./http.js";

export const getChecklistRoute = createRoute({
  method: "get",
  path: "/checklists/{bookingRequestId}",
  tags: ["Checklists"],
  request: { params: bookingRequestIdParams },
  responses: {
    200: { content: json(z.object({ checklist: checklistSchema })), description: "Checklist with items" },
    ...errors,
  },
});

export const getChecklistRouteHandler: AppRouteHandler<typeof getChecklistRoute> = async (c) => {
  const { bookingRequestId } = c.req.valid("param");
  const checklist = await getChecklistService(c.get("db"), bookingRequestId);
  if (!checklist) return c.json({ error: "Checklist not found" }, 404);
  return c.json({ checklist }, 200);
};
