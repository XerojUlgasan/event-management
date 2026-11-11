import { createRoute } from "@hono/zod-openapi";
import { acceptQuotationService } from "../../services/quotations/accept-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { quoteResult } from "./responses.js";
import { expectedBody, idParams } from "./schemas.js";
export const acceptQuotationRoute = createRoute({
  method: "post",
  path: "/quotations/{id}/accept",
  tags: ["Quotations"],
  request: { params: idParams, body: body(expectedBody) },
  responses: { 200: quoteResult, ...errors },
});
export const acceptQuotationRouteHandler: AppRouteHandler<
  typeof acceptQuotationRoute
> = async (c) => {
  const r = await acceptQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    c.req.valid("json").expectedUpdatedAt,
  );
  return "message" in r
    ? c.json({ error: r.message }, r.status)
    : c.json({ quotation: r }, 200);
};
