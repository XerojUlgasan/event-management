import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { contentSchema, publicSchema } from "../packages/schemas.js";
import { bookingSchema, idParams } from "./schemas.js";
import { errors, json } from "./http.js";
import { getBookingPackageService, saveCustomPackageService } from "../../services/booking-requests/custom-package.js";

const readResponses = { 200: { content: json(z.object({ package: publicSchema, bookingUpdatedAt: z.string() })), description: "Current booking package" }, 400: errors[400], 401: errors[401], 403: errors[403], 404: errors[404] };
export const getMyBookingPackageRoute = createRoute({ method: "get", path: "/booking-requests/{id}/package", tags: ["Booking requests"], request: { params: idParams }, responses: readResponses });
export const getMyBookingPackageRouteHandler: AppRouteHandler<typeof getMyBookingPackageRoute> = async c => {
  const result = await getBookingPackageService(c.get("db"), c.req.valid("param").id, c.get("session").user.id);
  return result ? c.json(result, 200) : c.json({ error: "Booking request not found" }, 404);
};
export const getAdminBookingPackageRoute = createRoute({ method: "get", path: "/admin/booking-requests/{id}/package", tags: ["Booking requests"], request: { params: idParams }, responses: readResponses });
export const getAdminBookingPackageRouteHandler: AppRouteHandler<typeof getAdminBookingPackageRoute> = async c => {
  const user = c.get("session").user;
  if (user.role !== "admin" || user.staff_role !== "System Administrator") return c.json({ error: "Booking request not found" }, 404);
  const result = await getBookingPackageService(c.get("db"), c.req.valid("param").id);
  return result ? c.json(result, 200) : c.json({ error: "Booking request not found" }, 404);
};
const saveSchema = contentSchema.extend({ expectedBookingUpdatedAt: z.string().datetime(), expectedUpdatedAt: z.string().datetime() });
const saveResponses = { 200: { content: json(z.object({ package: publicSchema, bookingRequest: bookingSchema })), description: "Saved private custom package and updated booking" }, 400: errors[400], 401: errors[401], 403: errors[403], 404: errors[404], 409: errors[409], 502: { content: json(z.object({ error: z.string() })), description: "Media copy failed" } };
export const createBookingCustomPackageRoute = createRoute({ method: "post", path: "/admin/booking-requests/{id}/custom-package", tags: ["Booking requests"], request: { params: idParams, body: { required: true, content: json(saveSchema) } }, responses: saveResponses });
export const createBookingCustomPackageRouteHandler: AppRouteHandler<typeof createBookingCustomPackageRoute> = async c => {
  const result = await saveCustomPackageService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, c.req.valid("json"), true);
  return "status" in result ? c.json({ error: result.message }, result.status) : c.json(result, 200);
};
export const updateBookingCustomPackageRoute = createRoute({ method: "put", path: "/admin/booking-requests/{id}/custom-package", tags: ["Booking requests"], request: { params: idParams, body: { required: true, content: json(saveSchema) } }, responses: saveResponses });
export const updateBookingCustomPackageRouteHandler: AppRouteHandler<typeof updateBookingCustomPackageRoute> = async c => {
  const result = await saveCustomPackageService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, c.req.valid("json"), false);
  return "status" in result ? c.json({ error: result.message }, result.status) : c.json(result, 200);
};
