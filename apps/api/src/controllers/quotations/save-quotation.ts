import { createRoute } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { saveQuotationService } from "../../services/quotations/save-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { body, errors } from "../booking-requests/http.js";
import { quoteResult } from "./responses.js";
import { idParams, saveBody } from "./schemas.js";
export const saveQuotationRoute = createRoute({
  method: "patch",
  path: "/admin/quotations/{id}",
  tags: ["Quotations"],
  request: { params: idParams, body: body(saveBody) },
  responses: { 200: quoteResult, ...errors },
});
export const saveQuotationRouteHandler: AppRouteHandler<
  typeof saveQuotationRoute
> = async (c) => {
  const input = c.req.valid("json");
  const r = await saveQuotationService(
    c.get("db"),
    c.req.valid("param").id,
    c.get("session").user.id,
    input.expectedUpdatedAt,
    input.items,
  );
  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json({ quotation: r }, 200);
};
