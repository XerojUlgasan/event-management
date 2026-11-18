import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { getQuotationService } from "../../services/quotations/get-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { errors } from "../booking-requests/http.js";
import { quoteResult } from "./responses.js";
import { idParams } from "./schemas.js";
export const getQuotationRoute = createRoute({
  method: "get",
  path: "/quotations/{id}",
  tags: ["Quotations"],
  request: { params: idParams },
  responses: { 200: quoteResult, ...errors },
});
export const getQuotationRouteHandler: AppRouteHandler<
  typeof getQuotationRoute
> = async (c) => {
  const r = await getQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
  );
  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json({ quotation: r }, 200);
};
