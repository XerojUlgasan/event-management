import { createPage } from "@event-management/contracts/pagination";
import { z } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../../db/types.js";
import {
  listStaffEventDaysPageData,
  type StaffDayFilter,
} from "../../data/event-days/list-staff-event-days-page.js";
import {
  encodePageCursor,
  parsePageCursor,
  postgresTimestampSchema,
} from "../../utils/pagination.js";
import { responses } from "./event-days.js";
const positionSchema = z.object({
  startsAt: postgresTimestampSchema,
  id: z.string().uuid(),
});
export async function listStaffEventDaysPageService(
  db: Kysely<DB>,
  staffId: string,
  assignmentsOnly: boolean,
  input: StaffDayFilter & { limit: number; cursor?: string },
) {
  const scope = JSON.stringify([
    "staff-event-days",
    staffId,
    assignmentsOnly,
    input.search,
    input.filter,
    input.date ?? null,
  ]);
  const cursor = parsePageCursor(input.cursor, positionSchema, scope);
  const rows = await listStaffEventDaysPageData(
    db,
    staffId,
    assignmentsOnly,
    input,
    input.limit,
    cursor,
  );
  const page = createPage(rows, input.limit, (row) =>
    encodePageCursor(scope, { startsAt: row.cursor_starts_at, id: row.id }),
  );
  return {
    eventDays: await responses(db, page.items, staffId, true),
    nextCursor: page.nextCursor,
  };
}
