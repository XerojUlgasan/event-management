import { z } from "@hono/zod-openapi";
import {
  createShowcaseRecordSchema,
  updateShowcaseRecordSchema,
} from "@event-management/contracts/showcase";

export const idParams = z.object({ id: z.string().uuid() });
export const slugParams = z.object({ slug: z.string().min(1).max(100) });

export { createShowcaseRecordSchema, updateShowcaseRecordSchema };
