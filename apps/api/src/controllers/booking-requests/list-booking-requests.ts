import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { listBookingRequestsService, listAdminBookingRequestsPageService } from "../../services/booking-requests/booking-requests.js";
import { bookingSchema, statusSchema } from "./schemas.js";
import { errors, json } from "./http.js";
const responses = {200:{content:json(z.object({bookingRequests:z.array(bookingSchema)})),description:"Booking requests"},401:errors[401],403:errors[403]};
export const listMyBookingRequestsRoute = createRoute({method:"get",path:"/booking-requests/mine",tags:["Booking requests"],responses});
export const listMyBookingRequestsRouteHandler: AppRouteHandler<typeof listMyBookingRequestsRoute> = async c => c.json({bookingRequests:await listBookingRequestsService(c.get("db"),c.get("session").user.id)},200);
const querySchema = z.object({ status: statusSchema.optional(), preferredDate: z.iso.date().refine(value => !value.startsWith("0000-"), "Invalid date").optional(), limit: z.string().regex(/^(?:[1-9]|[1-4][0-9]|50)$/).optional(), cursor: z.string().uuid().optional() });
export const listAdminBookingRequestsRoute = createRoute({method:"get",path:"/admin/booking-requests",tags:["Booking requests"],request:{query:querySchema},responses:{...responses,200:{content:json(z.object({bookingRequests:z.array(bookingSchema),nextCursor:z.string().uuid().nullable().optional()})),description:"Booking requests"},400:errors[400]}});
export const listAdminBookingRequestsRouteHandler: AppRouteHandler<typeof listAdminBookingRequestsRoute> = async c => {
  const query = c.req.valid("query");
  if (!Object.keys(query).length) return c.json({bookingRequests:await listBookingRequestsService(c.get("db"), undefined, c.get("session").user.role === "admin" && c.get("session").user.staff_role === "System Administrator")},200);
  return c.json(await listAdminBookingRequestsPageService(c.get("db"), {...query,limit:query.limit ? Number(query.limit) : 50}, c.get("session").user.role === "admin" && c.get("session").user.staff_role === "System Administrator"),200);
};
