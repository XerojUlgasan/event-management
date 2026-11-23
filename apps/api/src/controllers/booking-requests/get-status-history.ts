import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { getStatusHistoryService } from "../../services/booking-requests/get-status-history.js";
import { errors, json } from "./http.js";
import { idParams, statusSchema } from "./schemas.js";

const responses = {
  200: {
    content: json(
      z.object({
        history: z.array(
          z.object({
            id: z.string().uuid(),
            status: statusSchema,
            reason: z.string().nullable(),
            changedBy: z.string().uuid(),
            createdAt: z.string(),
          }),
        ),
        nextCursor: z.string().nullable(),
      }),
    ),
    description: "Booking status history",
  },
  400: errors[400],
  401: errors[401],
  403: errors[403],
  404: errors[404],
};

export const getMyStatusHistoryRoute = createRoute({
  method: "get",
  path: "/booking-requests/{id}/status-history",
  tags: ["Booking requests"],
  request: { params: idParams, query: paginationQuerySchema },
  responses,
});

export const getMyStatusHistoryRouteHandler: AppRouteHandler<
  typeof getMyStatusHistoryRoute
> = async (c) => {
  const result = await getStatusHistoryService(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("query"),
    c.get("session").user.id,
  );

  if (!result) return jsonError(c, "Booking request not found", 404);

  c.header("Cache-Control", "private, no-store");

  return c.json(result, 200);
};

export const getAdminStatusHistoryRoute = createRoute({
  method: "get",
  path: "/admin/booking-requests/{id}/status-history",
  tags: ["Booking requests"],
  request: {
    params: idParams,
    query: paginationQuerySchema.extend({
      order: z.literal("newest").optional(),
    }),
  },
  responses,
});

export const getAdminStatusHistoryRouteHandler: AppRouteHandler<
  typeof getAdminStatusHistoryRoute
> = async (c) => {
  const result = await getStatusHistoryService(
    c.get("db"),
    c.req.valid("param").id,
    c.req.valid("query"),
  );

  if (!result) return jsonError(c, "Booking request not found", 404);

  c.header("Cache-Control", "private, no-store");

  return c.json(result, 200);
};
