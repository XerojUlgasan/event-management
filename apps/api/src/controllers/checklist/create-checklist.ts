import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { createChecklistService } from "../../services/checklist/checklists.js";
import { checklistSchema, createChecklistSchema, bookingRequestIdParams } from "./schemas.js";
import { body, errors, json } from "./http.js";

export const createChecklistRoute = createRoute({
  method: "post",
  path: "/admin/booking-requests/{bookingRequestId}/checklist",
  tags: ["Checklists"],
  request: {
    params: bookingRequestIdParams,
    body: body(createChecklistSchema),
  },
  responses: {
    201: { content: json(z.object({ checklist: checklistSchema })), description: "Checklist created" },
    ...errors,
  },
});

export const createChecklistRouteHandler: AppRouteHandler<typeof createChecklistRoute> = async (c) => {
  const { bookingRequestId } = c.req.valid("param");
  const input = c.req.valid("json");
  const result = await createChecklistService(c.get("db"), {
    bookingRequestId,
    coordinatorId: input.coordinatorId,
    items: input.items,
  });
  if ("message" in result) return c.json({ error: result.message }, result.status);
  return c.json({ checklist: result }, 201);
};
