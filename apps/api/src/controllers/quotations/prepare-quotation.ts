import { createRoute } from "@hono/zod-openapi";
import { prepareQuotationService } from "../../services/quotations/prepare-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { errors } from "../booking-requests/http.js";
import { preparationResult } from "./responses.js";
import { idParams } from "./schemas.js";

export const prepareQuotationRoute = createRoute({
  method: "get",
  path: "/admin/booking-requests/{id}/quotations/prepare",
  tags: ["Quotations"],
  request: { params: idParams },
  responses: { 200: preparationResult, ...errors },
});

export const prepareQuotationRouteHandler: AppRouteHandler<
  typeof prepareQuotationRoute
> = async (c) => {
  const result = await prepareQuotationService(
    c.get("db"),
    c.req.valid("param").id,
  );

  return "message" in result
    ? jsonError(c, result.message, result.status)
    : c.json({ preparation: result }, 200);
};
