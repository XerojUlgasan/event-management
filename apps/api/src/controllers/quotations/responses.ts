import { z } from "@hono/zod-openapi";
import { json } from "../booking-requests/http.js";
import { quotationSchema } from "./schemas.js";
export const quoteResult = {
  content: json(z.object({ quotation: quotationSchema })),
  description: "Quotation",
};
export const listResult = {
  content: json(z.object({ quotations: z.array(quotationSchema) })),
  description: "Quotation history",
};
export const ackResult = {
  content: json(z.object({ ok: z.literal(true) })),
  description: "Revision requested",
};
