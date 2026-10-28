import { Hono } from "hono";
import { db } from "../../db/client.js";
import { requireSession } from "../../middleware/auth.js";
import { requireAdmin } from "../../lib/api-helpers.js";

const app = new Hono();

/**
 * GET /admin/customers?search=term&limit=10
 * Search customers by name or email. Admin only.
 */
app.get("/admin/customers", requireSession, requireAdmin, async (c) => {
  const search = c.req.query("search") ?? "";
  const limit = Math.min(Number(c.req.query("limit") ?? "10"), 50);

  if (search.trim().length < 2) {
    return c.json({ customers: [] });
  }

  const searchTerm = `%${search.trim()}%`;

  const rows = await db
    .selectFrom("users")
    .select(["id", "display_name", "email"])
    .where((eb) =>
      eb.or([
        eb("display_name", "ilike", searchTerm),
        eb("email", "ilike", searchTerm),
      ]),
    )
    .limit(limit)
    .execute();

  return c.json({
    customers: rows.map((u) => ({
      id: u.id,
      displayName: u.display_name,
      email: u.email,
    })),
  });
});

export default app;
