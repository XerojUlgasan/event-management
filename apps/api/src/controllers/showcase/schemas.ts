import { z } from "@hono/zod-openapi";
import {
  createShowcaseRecordSchema,
  updateShowcaseRecordSchema,
} from "@event-management/contracts/showcase";

import {
  paginationQuerySchema,
  postgresTimestampSchema,
} from "../../utils/pagination.js";

export const showcasePageQuery = paginationQuerySchema.extend({
  cursor: paginationQuerySchema.shape.cursor.refine((cursor) => {
    if (cursor === undefined) return true;

    const parts = cursor.split("_");

    return (
      parts.length === 2 &&
      postgresTimestampSchema.safeParse(parts[0]).success &&
      z.guid().safeParse(parts[1]).success
    );
  }, "Invalid showcase cursor."),
});

// Existing showcase IDs include seed values accepted by PostgreSQL UUID columns.
export const idParams = z.object({ id: z.guid().toLowerCase() });

export const slugParams = z.object({ slug: z.string().min(1).max(100) });

export { createShowcaseRecordSchema, updateShowcaseRecordSchema };
