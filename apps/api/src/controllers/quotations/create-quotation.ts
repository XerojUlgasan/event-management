import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { createQuotationService } from "../../services/quotations/create-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { quoteResult } from "./responses.js";
import { expectedBody, idParams } from "./schemas.js";
export const createQuotationRoute = createRoute({
  method: "post",
  path: "/admin/booking-requests/{id}/quotations",
  tags: ["Quotations"],
  request: { params: idParams, body: body(expectedBody) },
  responses: { 201: quoteResult, ...errors },
});
export const createQuotationRouteHandler: AppRouteHandler<
  typeof createQuotationRoute
> = async (c) => {
  const r = await createQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json").expectedUpdatedAt,
  );
  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json({ quotation: r }, 201);
};
