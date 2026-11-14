import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { listEventDaysData } from "../../data/event-days/list-event-days.js";
import { responses } from "../../services/event-days/event-days.js";
import { params, response, tags } from "./schemas.js";
export const getStaffEventDayRoute = createRoute({
  method: "get",
  path: "/staff/event-days/{id}",
  tags,
  request: { params },
  responses: response,
});
export const getStaffEventDayRouteHandler: AppRouteHandler<
  typeof getStaffEventDayRoute
> = async (c) => {
  const staffId = c.get("session").user.id;
  const rows = await listEventDaysData(
    c.get("db"),
    undefined,
    staffId,
    false,
    c.req.valid("param").id,
  );
  if (!rows.length) return c.json({ error: "Event day not found" }, 404);
  const eventDay = (await responses(c.get("db"), rows, staffId))[0];
  if (!eventDay) return c.json({ error: "Event day not found" }, 404);
  return c.json({ eventDay }, 200);
};
