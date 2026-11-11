import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { publicSchema } from "../packages/schemas.js";
import { idParams } from "./schemas.js";
import { errors, json } from "./http.js";
import { getBookingPackageService } from "../../services/booking-requests/get-booking-package.js";

const readResponses = { 200: { content: json(z.object({ package: publicSchema, bookingUpdatedAt: z.string() })), description: "Current booking package" }, 400: errors[400], 401: errors[401], 403: errors[403], 404: errors[404] };
export const getMyBookingPackageRoute = createRoute({ method: "get", path: "/booking-requests/{id}/package", tags: ["Booking requests"], request: { params: idParams }, responses: readResponses });
export const getMyBookingPackageRouteHandler: AppRouteHandler<typeof getMyBookingPackageRoute> = async c => {
  const result = await getBookingPackageService(c.get("db"), c.req.valid("param").id, c.get("session").user.id);
  c.header("Cache-Control", "private, no-store");
  return result ? c.json(result, 200) : c.json({ error: "Booking request not found" }, 404);
};
export const getAdminBookingPackageRoute = createRoute({ method: "get", path: "/admin/booking-requests/{id}/package", tags: ["Booking requests"], request: { params: idParams }, responses: readResponses });
export const getAdminBookingPackageRouteHandler: AppRouteHandler<typeof getAdminBookingPackageRoute> = async c => {
  const user = c.get("session").user;
  if (user.role !== "admin" || user.staff_role !== "System Administrator") return c.json({ error: "Booking request not found" }, 404);
  const result = await getBookingPackageService(c.get("db"), c.req.valid("param").id);
  c.header("Cache-Control", "private, no-store");
  return result ? c.json(result, 200) : c.json({ error: "Booking request not found" }, 404);
};
