import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { requestRevisionQuotationService } from "../../services/quotations/request-revision-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { quoteResult } from "./responses.js";
import { expectedBody, idParams } from "./schemas.js";

export const requestRevisionQuotationRoute = createRoute({
  method: "post",
  path: "/quotations/{id}/request-revision",
  tags: ["Quotations"],
  request: { params: idParams, body: body(expectedBody) },
  responses: { 200: quoteResult, ...errors },
});

export const requestRevisionQuotationRouteHandler: AppRouteHandler<
  typeof requestRevisionQuotationRoute
> = async (c) => {
  const r = await requestRevisionQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json").expectedUpdatedAt,
  );

  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json({ quotation: r }, 200);
};
