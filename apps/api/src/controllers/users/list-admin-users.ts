import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { listUsersData } from "../../data/auth/list-users.js";

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const errorSchema = z.object({ error: z.string() });

const userSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  email: z.string(),
  role: z.enum(["admin", "customer"]),
  staffRole: z.string().nullable(),
  createdAt: z.string(),
});

export const listAdminUsersRoute = createRoute({
  method: "get",
  path: "/admin/users",
  tags: ["Users"],
  responses: {
    200: { content: json(z.object({ staff: z.array(userSchema), customers: z.array(userSchema) })), description: "Staff and customer lists" },
    401: { content: json(errorSchema), description: "Not signed in" },
    403: { content: json(errorSchema), description: "Admin access required" },
  },
});

export const listAdminUsersRouteHandler: AppRouteHandler<typeof listAdminUsersRoute> = async (c) => {
  const db = c.get("db");
  const [staff, customers] = await Promise.all([
    listUsersData(db, "admin"),
    listUsersData(db, "customer"),
  ]);
  const toDto = (row: (typeof staff)[number]) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: row.role as "admin" | "customer",
    staffRole: row.staff_role ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  });
  return c.json({ staff: staff.map(toDto), customers: customers.map(toDto) }, 200);
};
