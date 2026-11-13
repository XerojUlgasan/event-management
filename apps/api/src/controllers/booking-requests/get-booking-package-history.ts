import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publicSchema } from "../packages/schemas.js";
import { idParams } from "./schemas.js";
import { errors, json } from "./http.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { getBookingPackageHistoryService } from "../../services/booking-requests/get-booking-package-history.js";

export const getAdminBookingPackageHistoryRoute = createRoute({ method: "get", path: "/admin/booking-requests/{id}/package-history", tags: ["Booking requests"], request: { params: idParams, query: paginationQuerySchema }, responses: { 200: { content: json(z.object({ history: z.array(z.object({ id: z.string().uuid(), actorId: z.string().uuid().nullable(), action: z.string(), before: publicSchema, after: publicSchema, createdAt: z.string() })), nextCursor: z.string().nullable() })), description: "Private package edit history" }, 400: errors[400], 401: errors[401], 403: errors[403], 404: errors[404] } });
export const getAdminBookingPackageHistoryRouteHandler: AppRouteHandler<typeof getAdminBookingPackageHistoryRoute> = async c => {
  const user = c.get("session").user;
  if (user.role !== "admin" || user.staff_role !== "System Administrator") return c.json({ error: "Booking request not found" }, 404);
  const history = await getBookingPackageHistoryService(c.get("db"), c.req.valid("param").id, c.req.valid("query"));
  if (!history) return c.json({ error: "Booking request not found" }, 404);
  c.header("Cache-Control", "private, no-store");
  return c.json(history, 200);
};
