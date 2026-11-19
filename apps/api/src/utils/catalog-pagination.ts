import { z } from "@hono/zod-openapi";
import type { CatalogFilters } from "@event-management/contracts/catalog-filters";
import {
  encodePageCursor,
  parsePageCursor,
  postgresTimestampSchema,
} from "./pagination.js";

export type CatalogListOptions = CatalogFilters & {
  limit: number;
  cursor?: string;
  search?: string;
  archived?: "all" | "active" | "archived";
};

const positionSchema = z.object({
  sort: z.string().min(1).max(256),
  id: z.string().uuid(),
});

export type CatalogPosition = z.infer<typeof positionSchema>;

export function catalogCursor(
  cursor: string | undefined,
  scope: string,
  sort: "name" | "timestamp" = "timestamp",
) {
  return {
    position: parsePageCursor(
      cursor,
      sort === "name"
        ? positionSchema
        : positionSchema.extend({
            sort: postgresTimestampSchema.refine(
              (value) =>
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
                new Date(value).toISOString().slice(0, 19) ===
                  value.slice(0, 19),
            ),
          }),
      scope,
    ),
    cursorFor: (row: { page_sort: string; id: string }) =>
      encodePageCursor(scope, { sort: row.page_sort, id: row.id }),
  };
}
