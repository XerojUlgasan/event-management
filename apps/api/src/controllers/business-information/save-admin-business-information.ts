import {
  businessInformationResponseSchema,
  saveBusinessInformationSchema,
} from "@event-management/contracts/business-information";
import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { jsonError } from "../../utils/service-result.js";
import { saveBusinessInformationService } from "../../services/business-information/save-business-information.js";
import { body, errors, json } from "./http.js";

export const saveAdminBusinessInformationRoute = createRoute({
  method: "put",
  path: "/admin/business-information",
  tags: ["Business information"],
  request: { body: body(saveBusinessInformationSchema) },
  responses: {
    200: {
      content: json(businessInformationResponseSchema),
      description: "Saved business information",
    },
    ...errors,
  },
});

export const saveAdminBusinessInformationRouteHandler: AppRouteHandler<
  typeof saveAdminBusinessInformationRoute
> = async (c) => {
  const value = await saveBusinessInformationService(
    c.get("db"),
    c.req.valid("json"),
  );

  if ("status" in value) return jsonError(c, value.message, value.status);

  return c.json(value, 200);
};
