import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireSession } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { commonErrors, json, requireAdmin } from "../../lib/api-helpers.js";
import {
  supplierListSchema,
  supplierSchema,
  supplierQuerySchema,
  availabilityQuerySchema,
  availabilitySchema,
} from "./schemas.js";
import {
  listSupplierRows,
  getSupplierRow,
  supplierDto,
  checkSupplierAvailability,
} from "./store.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        { error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") },
        400,
      );
    }
  },
});

const errors = commonErrors("supplier");
const idParam = z.object({ id: z.string().uuid() });

routes.use("/admin/suppliers", requireSession, requireAdmin);
routes.use("/admin/suppliers/*", requireSession, requireAdmin);

// ── GET /admin/suppliers ─────────────────────────────────────────────────────

const listRoute = createRoute({
  method: "get",
  path: "/admin/suppliers",
  tags: ["Suppliers"],
  request: { query: supplierQuerySchema },
  responses: {
    200: { content: json(supplierListSchema), description: "List of suppliers" },
    ...errors,
  },
});
routes.openapi(listRoute, async (c) => {
  const { category, search } = c.req.valid("query");
  const rows = await listSupplierRows(c.get("db"), { category, search });
  const suppliers = rows.map(supplierDto);
  return c.json({ suppliers }, 200);
});

// ── GET /admin/suppliers/:id ─────────────────────────────────────────────────

const getRoute = createRoute({
  method: "get",
  path: "/admin/suppliers/{id}",
  tags: ["Suppliers"],
  request: { params: idParam },
  responses: {
    200: { content: json(supplierSchema), description: "Supplier detail" },
    ...errors,
  },
});
routes.openapi(getRoute, async (c) => {
  const row = await getSupplierRow(c.get("db"), c.req.valid("param").id);
  if (!row) return c.json({ error: "Supplier not found" }, 404);
  return c.json(supplierDto(row), 200);
});

// ── GET /admin/suppliers/:id/availability ────────────────────────────────────

const availabilityRoute = createRoute({
  method: "get",
  path: "/admin/suppliers/{id}/availability",
  tags: ["Suppliers"],
  request: {
    params: idParam,
    query: availabilityQuerySchema,
  },
  responses: {
    200: { content: json(availabilitySchema), description: "Supplier availability" },
    ...errors,
  },
});
routes.openapi(availabilityRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { date, startTime, endTime } = c.req.valid("query");

  const supplier = await getSupplierRow(c.get("db"), id);
  if (!supplier) return c.json({ error: "Supplier not found" }, 404);

  const result = await checkSupplierAvailability(
    c.get("db"),
    id,
    date,
    startTime,
    endTime,
  );

  return c.json(result, 200);
});

export default routes;
