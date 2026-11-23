import { z } from "@hono/zod-openapi";
import {
  createShowcaseRecordSchema,
  updateShowcaseRecordSchema,
} from "@event-management/contracts/showcase";

// Existing showcase IDs include seed values accepted by PostgreSQL UUID columns.
export const idParams = z.object({ id: z.guid().toLowerCase() });
export const slugParams = z.object({ slug: z.string().min(1).max(100) });

export { createShowcaseRecordSchema, updateShowcaseRecordSchema };
