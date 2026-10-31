import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { threadSchema } from "./schemas.js";
import { errors, json } from "./http.js";
import { requestStaffService } from "../../services/messages/request-staff.js";

export const requestStaffRoute = createRoute({
  method: "post",
  path: "/messages/conversation/request-staff",
  tags: ["Messages"],
  summary: "Mark the conversation as waiting for staff assistance",
  responses: {
    200: { content: json(threadSchema), description: "Conversation waiting for staff" },
    401: errors[401],
    403: errors[403],
  },
});
export const requestStaffRouteHandler: AppRouteHandler<typeof requestStaffRoute> = async (c) =>
  c.json(await requestStaffService(c.get("db"), c.get("session").user.id), 200);
