import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { listBookingRequestDailyCountsService } from "../../services/booking-requests/list-booking-request-daily-counts.js";
import { statusSchema } from "./schemas.js";
import { errors, json } from "./http.js";

export const getBookingCalendarRoute = createRoute({method:"get",path:"/admin/booking-requests/calendar",tags:["Booking requests"],request:{query:z.object({month:z.string().regex(/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/),status:statusSchema.optional()})},responses:{200:{content:json(z.object({dailyCounts:z.array(z.object({preferredDate:z.string(),count:z.number()}))})),description:"Request counts by preferred date"},400:errors[400],401:errors[401],403:errors[403]}});
export const getBookingCalendarRouteHandler: AppRouteHandler<typeof getBookingCalendarRoute> = async c => {
  const {month,status} = c.req.valid("query");
  return c.json({dailyCounts:await listBookingRequestDailyCountsService(c.get("db"),month,status)},200);
};
