import { z } from "@hono/zod-openapi";
import { json } from "../booking-requests/http.js";
import { preparationSchema, quotationSchema } from "./schemas.js";

export const quoteResult = {
  content: json(z.object({ quotation: quotationSchema })),
  description: "Quotation",
};

export const listResult = {
  content: json(
    z.object({
      quotations: z.array(quotationSchema),
      nextCursor: z.string().nullable(),
      currentOffer: quotationSchema.nullable(),
    }),
  ),
  description: "Quotation history",
};

export const preparationResult = {
  content: json(z.object({ preparation: preparationSchema })),
  description: "Current package and offer terms for preparing a quotation",
};
