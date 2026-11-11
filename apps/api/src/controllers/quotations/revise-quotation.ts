import { createRoute } from "@hono/zod-openapi";
import { reviseQuotationService } from "../../services/quotations/revise-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { ackResult, quoteResult } from "./responses.js";
import { idParams, reviseBody } from "./schemas.js";
export const reviseAdminQuotationRoute = createRoute({
  method: "post",
  path: "/admin/quotations/{id}/revision",
  tags: ["Quotations"],
  request: { params: idParams, body: body(reviseBody) },
  responses: { 201: quoteResult, ...errors },
});
export const reviseAdminQuotationRouteHandler: AppRouteHandler<
  typeof reviseAdminQuotationRoute
> = async (c) => {
  const input = c.req.valid("json");
  const r = await reviseQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    input.expectedUpdatedAt,
    input.reason,
    false,
  );
  return "message" in r
    ? c.json({ error: r.message }, r.status)
    : "ok" in r
      ? c.json({ error: "Unexpected revision result" }, 409)
      : c.json({ quotation: r }, 201);
};

export const reviseCustomerQuotationRoute = createRoute({
  method: "post",
  path: "/quotations/{id}/revision",
  tags: ["Quotations"],
  request: { params: idParams, body: body(reviseBody) },
  responses: { 201: ackResult, ...errors },
});
export const reviseCustomerQuotationRouteHandler: AppRouteHandler<
  typeof reviseCustomerQuotationRoute
> = async (c) => {
  const input = c.req.valid("json");
  const r = await reviseQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    input.expectedUpdatedAt,
    input.reason,
    true,
  );
  return "message" in r
    ? c.json({ error: r.message }, r.status)
    : c.json({ ok: true as const }, 201);
};
