import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import { createRoute } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import { errors, body, json } from "../booking-requests/http.js";
import { bookingIdParams, quotationIdParams, quotationItemsBody, quotationSchema, revisionBody } from "./schemas.js";
import { acceptQuotationService, createQuotationService, listQuotationsService, requestQuotationRevisionService, sendQuotationService, updateQuotationService } from "../../services/quotations/quotations.js";
import { z } from "@hono/zod-openapi";

const routes = new OpenAPIHono<HonoEnv>({ defaultHook: (result, c) => result.success ? undefined : c.json({ error: result.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ") }, 400) });
const resultSchema = json(z.object({ quotation: quotationSchema }));
const listSchema = json(z.object({ quotations: z.array(quotationSchema) }));
const admin = createMiddleware<HonoEnv>(async (c, next) => requireSystemAdmin(c, next));
const customer = createMiddleware<HonoEnv>(async (c, next) => { if (c.get("session").user.role !== "customer") return c.json({ error: "Customer access required" }, 403); await next(); });

routes.use("/admin/booking-requests/*", requireSession, admin);
routes.use("/admin/quotations/*", requireSession, admin);
routes.use("/booking-requests/*", requireSession, customer);
routes.use("/quotations/*", requireSession, customer);

const createQuotationRoute = createRoute({
  method: "post" as const,
  path: "/admin/booking-requests/{id}/quotations" as const,
  tags: ["Quotations"],
  request: { params: bookingIdParams },
  responses: { 201: { content: resultSchema, description: "Quotation draft created" }, ...errors },
});
const listRoute = createRoute({
  method: "get" as const,
  path: "/admin/booking-requests/{id}/quotations" as const,
  tags: ["Quotations"],
  request: { params: bookingIdParams },
  responses: { 200: { content: listSchema, description: "Quotation history" }, ...errors },
});
const updateRoute = createRoute({
  method: "patch" as const,
  path: "/admin/quotations/{id}" as const,
  tags: ["Quotations"],
  request: { params: quotationIdParams, body: body(quotationItemsBody) },
  responses: { 200: { content: resultSchema, description: "Quotation draft updated" }, ...errors },
});
const sendRoute = createRoute({
  method: "post" as const,
  path: "/admin/quotations/{id}/send" as const,
  tags: ["Quotations"],
  request: { params: quotationIdParams },
  responses: { 200: { content: resultSchema, description: "Quotation sent" }, ...errors },
});
const latestRoute = createRoute({
  method: "get" as const,
  path: "/booking-requests/{id}/quotation" as const,
  tags: ["Quotations"],
  request: { params: bookingIdParams },
  responses: { 200: { content: resultSchema, description: "Latest active quotation" }, ...errors },
});
const acceptRoute = createRoute({
  method: "post" as const,
  path: "/quotations/{id}/accept" as const,
  tags: ["Quotations"],
  request: { params: quotationIdParams },
  responses: { 200: { content: resultSchema, description: "Quotation accepted" }, ...errors },
});
const revisionRoute = createRoute({
  method: "post" as const,
  path: "/quotations/{id}/revision" as const,
  tags: ["Quotations"],
  request: { params: quotationIdParams, body: body(revisionBody) },
  responses: { 201: { content: resultSchema, description: "Quotation revision draft created" }, ...errors },
});

const adminRevisionRoute = createRoute({
  method: "post" as const,
  path: "/admin/quotations/{id}/revision" as const,
  tags: ["Quotations"],
  request: { params: quotationIdParams, body: body(revisionBody) },
  responses: { 201: { content: resultSchema, description: "Quotation revision draft created" }, ...errors },
});

routes.openapi(createQuotationRoute, async c => { const result = await createQuotationService(c.get("db"), c.req.valid("param").id, c.get("session").user.id); if ("message" in result) return c.json({ error: result.message }, result.status); return c.json({ quotation: result }, 201); });
routes.openapi(listRoute, async c => { const result = await listQuotationsService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, false); if ("message" in result) return c.json({ error: result.message }, result.status); return c.json({ quotations: result }, 200); });
routes.openapi(updateRoute, async c => { const input = c.req.valid("json"); const result = await updateQuotationService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, input.items, input.expectedUpdatedAt); if ("message" in result) return c.json({ error: result.message }, result.status); return c.json({ quotation: result }, 200); });
routes.openapi(sendRoute, async c => { const result = await sendQuotationService(c.get("db"), c.req.valid("param").id, c.get("session").user.id); if ("message" in result) return c.json({ error: result.message }, result.status); return c.json({ quotation: result }, 200); });
routes.openapi(latestRoute, async c => { const rows = await listQuotationsService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, true); if ("message" in rows) return c.json({ error: rows.message }, rows.status); const quotation = rows.find(row => row.status === "sent" || row.status === "accepted"); return quotation ? c.json({ quotation }, 200) : c.json({ error: "Quotation not found" }, 404); });
routes.openapi(acceptRoute, async c => { const result = await acceptQuotationService(c.get("db"), c.req.valid("param").id, c.get("session").user.id); if ("message" in result) return c.json({ error: result.message }, result.status); return c.json({ quotation: result }, 200); });
routes.openapi(adminRevisionRoute, async c => { const result = await requestQuotationRevisionService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, c.req.valid("json").reason, true); if ("message" in result) return c.json({ error: result.message }, result.status); return c.json({ quotation: result }, 201); });
routes.openapi(revisionRoute, async c => { const result = await requestQuotationRevisionService(c.get("db"), c.req.valid("param").id, c.get("session").user.id, c.req.valid("json").reason); if ("message" in result) return c.json({ error: result.message }, result.status); return c.json({ quotation: result }, 201); });

export default routes;
