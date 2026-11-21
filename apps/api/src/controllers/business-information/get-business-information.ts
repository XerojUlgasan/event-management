import { businessInformationResponseSchema } from "@event-management/contracts/business-information";
import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { getBusinessInformationService } from "../../services/business-information/get-business-information.js";
import { json } from "./http.js";

export const getBusinessInformationRoute = createRoute({
  method: "get",
  path: "/business-information",
  tags: ["Business information"],
  responses: {
    200: {
      content: json(businessInformationResponseSchema),
      description: "Public business information",
    },
  },
});

export const getBusinessInformationRouteHandler: AppRouteHandler<
  typeof getBusinessInformationRoute
> = async (c) => {
  const value = await getBusinessInformationService(c.get("db"));

  return c.json(value, 200);
};
