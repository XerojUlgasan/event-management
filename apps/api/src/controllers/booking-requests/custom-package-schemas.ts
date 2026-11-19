import { z } from "@hono/zod-openapi";
import { contentSchema, publicSchema } from "../packages/schemas.js";
import { bookingSchema } from "./schemas.js";
import { errors, json } from "./http.js";

export const saveSchema = contentSchema.extend({
  expectedBookingUpdatedAt: z.string(),
  expectedUpdatedAt: z.string().datetime().optional(),
  sourcePackageId: z.string().uuid().optional(),
});

export const updateSchema = saveSchema.extend({
  expectedUpdatedAt: z.string().datetime(),
});

export const saveResponses = {
  200: {
    content: json(
      z.object({ package: publicSchema, bookingRequest: bookingSchema }),
    ),
    description: "Saved private package",
  },
  400: errors[400],
  401: errors[401],
  403: errors[403],
  404: errors[404],
  409: errors[409],
  502: {
    content: json(z.object({ error: z.string() })),
    description: "Media copy failed",
  },
};
