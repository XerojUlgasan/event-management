import { createPage } from "@event-management/contracts/pagination";
import type { EventDayStaffRow } from "@event-management/contracts/event-days";
import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import { getEventDayData } from "../../data/event-days/get-event-day.js";
import { listEventDayStaffPageData } from "../../data/event-days/list-event-day-staff-page.js";
import { encodePageCursor, parsePageCursor } from "../../utils/pagination.js";
import { fail } from "./event-days.js";
const positionSchema = z.object({ name: z.string(), id: z.string().uuid() });
export async function listEventDayStaffPageService(
  db: Kysely<DB>,
  id: string,
  input: { limit: number; cursor?: string },
) {
  if (!(await getEventDayData(db, id))) return fail("Event day not found", 404);
  const scope = `event-day-staff:${id}:available`;
  const cursor = parsePageCursor(input.cursor, positionSchema, scope);
  const page = createPage(
    await listEventDayStaffPageData(db, id, input.limit, cursor),
    input.limit,
    (row) =>
      encodePageCursor(scope, { name: row.staff_name, id: row.staff_id }),
  );
  const staff: EventDayStaffRow[] = page.items.map((row) => ({
    staffId: row.staff_id,
    staffName: row.staff_name,
    eligible: row.eligible,
    assignment:
      row.assignment_role && row.assignment_status
        ? { role: row.assignment_role, status: row.assignment_status }
        : null,
  }));
  return { staff, nextCursor: page.nextCursor };
}
