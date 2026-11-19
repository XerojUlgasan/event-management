import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { sendQuotationService } from "../../services/quotations/send-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { quoteResult } from "./responses.js";
import { expectedBody, idParams } from "./schemas.js";

export const sendQuotationRoute = createRoute({
  method: "post",
  path: "/admin/quotations/{id}/send",
  tags: ["Quotations"],
  request: { params: idParams, body: body(expectedBody) },
  responses: { 200: quoteResult, ...errors },
});

export const sendQuotationRouteHandler: AppRouteHandler<
  typeof sendQuotationRoute
> = async (c) => {
  const r = await sendQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json").expectedUpdatedAt,
  );

  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json({ quotation: r }, 200);
};
