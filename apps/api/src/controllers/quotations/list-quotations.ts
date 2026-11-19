import { createRoute, z } from "@hono/zod-openapi";
import { jsonError } from "../../utils/service-result.js";
import { listQuotationService } from "../../services/quotations/list-quotation.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { errors } from "../booking-requests/http.js";
import { paginationQuerySchema } from "../../utils/pagination.js";
import { listResult } from "./responses.js";
import { idParams } from "./schemas.js";

const querySchema = paginationQuerySchema.extend({
  quotationId: z.string().uuid().optional(),
});

export const listAdminQuotationsRoute = createRoute({
  method: "get",
  path: "/admin/booking-requests/{id}/quotations",
  tags: ["Quotations"],
  request: { params: idParams, query: querySchema },
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
    c.req.valid("query"),
  );

  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json(r, 200);
};

export const listCustomerQuotationsRoute = createRoute({
  method: "get",
  path: "/booking-requests/{id}/quotations",
  tags: ["Quotations"],
  request: { params: idParams, query: querySchema },
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
    c.req.valid("query"),
  );

  return "message" in r
    ? jsonError(c, r.message, r.status)
    : c.json(r, 200);
};
