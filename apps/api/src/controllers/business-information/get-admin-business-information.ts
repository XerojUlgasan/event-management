import { businessInformationResponseSchema } from "@event-management/contracts/business-information";
import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { getBusinessInformationService } from "../../services/business-information/get-business-information.js";
import { errors, json } from "./http.js";

export const getAdminBusinessInformationRoute = createRoute({
  method: "get",
  path: "/admin/business-information",
  tags: ["Business information"],
  responses: {
    200: {
      content: json(businessInformationResponseSchema),
      description: "Business information for admin editing",
    },
    401: errors[401],
    403: errors[403],
  },
});

export const getAdminBusinessInformationRouteHandler: AppRouteHandler<
  typeof getAdminBusinessInformationRoute
> = async (c) => {
  const value = await getBusinessInformationService(c.get("db"));

  return c.json(value, 200);
};
