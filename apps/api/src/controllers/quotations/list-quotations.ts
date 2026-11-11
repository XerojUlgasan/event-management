import { createRoute } from "@hono/zod-openapi";
import { listQuotationService } from "../../services/quotations/list-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { errors } from "../booking-requests/http.js";
import { listResult } from "./responses.js";
import { idParams } from "./schemas.js";
export const listAdminQuotationsRoute = createRoute({
  method: "get",
  path: "/admin/booking-requests/{id}/quotations",
  tags: ["Quotations"],
  request: { params: idParams },
  responses: { 200: listResult, ...errors },
});
export const listAdminQuotationsRouteHandler: AppRouteHandler<
  typeof listAdminQuotationsRoute
> = async (c) => {
  const r = await listQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    false,
  );
  return "message" in r
    ? c.json({ error: r.message }, r.status)
    : c.json({ quotations: r }, 200);
};

export const listCustomerQuotationsRoute = createRoute({
  method: "get",
  path: "/booking-requests/{id}/quotations",
  tags: ["Quotations"],
  request: { params: idParams },
  responses: { 200: listResult, ...errors },
});
export const listCustomerQuotationsRouteHandler: AppRouteHandler<
  typeof listCustomerQuotationsRoute
> = async (c) => {
  const r = await listQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    true,
  );
  return "message" in r
    ? c.json({ error: r.message }, r.status)
    : c.json({ quotations: r }, 200);
};
