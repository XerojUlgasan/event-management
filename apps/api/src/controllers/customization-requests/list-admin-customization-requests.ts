import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { listAdminCustomizationRequestsService } from "../../services/customization-requests/customization-requests.js";
import { errors, json } from "../booking-requests/http.js";
import {
  adminCustomizationRequestSchema,
  adminListQuerySchema,
} from "./schemas.js";

export const listAdminCustomizationRequestsRoute = createRoute({
  method: "get",
  path: "/admin/customization-requests",
  tags: ["Customization requests"],
  request: { query: adminListQuerySchema },
  responses: {
    200: {
      content: json(
        z.object({
          requests: z.array(adminCustomizationRequestSchema),
          nextCursor: z.string().uuid().nullable(),
        }),
      ),
      description: "Customization requests across bookings",
    },
    ...errors,
  },
});

export const listAdminCustomizationRequestsRouteHandler: AppRouteHandler<
  typeof listAdminCustomizationRequestsRoute
> = async (c) => {
  const query = c.req.valid("query");
  return c.json(
    await listAdminCustomizationRequestsService(c.get("db"), {
      status: query.status,
      cursor: query.cursor,
      limit: query.limit ? Number(query.limit) : 50,
    }),
    200,
  );
};
