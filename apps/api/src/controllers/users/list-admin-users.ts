import { createRoute, z } from "@hono/zod-openapi";
import { createPage } from "@event-management/contracts/pagination";
import type { AppRouteHandler } from "../../types/hono.js";
import {
  listUsersData,
  userDirectoryStats,
} from "../../data/auth/list-users.js";
import {
  encodePageCursor,
  parsePageCursor,
  paginationQuerySchema,
} from "../../utils/pagination.js";

const json = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});
const errorSchema = z.object({ error: z.string() });
const userSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  email: z.string(),
  role: z.enum(["admin", "customer"]),
  staffRole: z.string().nullable(),
  createdAt: z.string(),
});
const statsSchema = z.object({
  staffTotal: z.number(),
  customerTotal: z.number(),
  staffRoles: z.number(),
  staffJoined: z.number(),
  customerJoined: z.number(),
});
const querySchema = paginationQuerySchema.extend({
  group: z.enum(["customers"]).default("customers"),
  search: z.string().max(200).default(""),
});
const positionSchema = z.object({ name: z.string(), id: z.string().uuid() });
export const listAdminUsersRoute = createRoute({
  method: "get",
  path: "/admin/users",
  tags: ["Users"],
  request: { query: querySchema },
  responses: {
    200: {
      content: json(
        z.object({
          staff: z.array(userSchema),
          customers: z.array(userSchema),
          nextCursor: z.string().nullable(),
          stats: statsSchema,
        }),
      ),
      description: "Directory page and population statistics",
    },
    400: { content: json(errorSchema), description: "Invalid query" },
    401: { content: json(errorSchema), description: "Not signed in" },
    403: { content: json(errorSchema), description: "Admin access required" },
  },
});
export const listAdminUsersRouteHandler: AppRouteHandler<
  typeof listAdminUsersRoute
> = async (c) => {
  const { group, search: rawSearch, cursor, limit } = c.req.valid("query");
  const search = rawSearch.trim().toLowerCase();
  const scope = JSON.stringify(["users", group, search]);
  const position = parsePageCursor(cursor, positionSchema, scope);
  const [rows, stats] = await Promise.all([
    listUsersData(c.get("db"), { group, search, position, limit }),
    userDirectoryStats(c.get("db")),
  ]);
  const page = createPage(rows, limit, (row) =>
    encodePageCursor(scope, { name: row.cursor_name, id: row.id }),
  );
  const users = page.items.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: row.role as "admin" | "customer",
    staffRole: row.staff_role ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
  return c.json(
    {
      staff: [],
      customers: users,
      nextCursor: page.nextCursor,
      stats,
    },
    200,
  );
};
