import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { reviseQuotationService } from "../../services/quotations/revise-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { quoteResult } from "./responses.js";
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
  );
  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json({ quotation: r }, 201);
};
