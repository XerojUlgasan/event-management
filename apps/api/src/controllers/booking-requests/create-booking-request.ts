import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { createBookingRequestService } from "../../services/booking-requests/create-booking-request.js";
import { bookingSchema, createSchema } from "./schemas.js";
import { body, errors, json } from "./http.js";
export const createBookingRequestRoute = createRoute({ method:"post", path:"/booking-requests", tags:["Booking requests"], request:{body:body(createSchema)}, responses:{201:{content:json(z.object({bookingRequest:bookingSchema})),description:"Request submitted"},...errors} });
export const createBookingRequestRouteHandler: AppRouteHandler<typeof createBookingRequestRoute> = async c => { const result = await createBookingRequestService(c.get("db"), c.get("session").user.id, c.req.valid("json")); if ("message" in result) return c.json({error:result.message}, result.status); return c.json({bookingRequest:result},201); };
