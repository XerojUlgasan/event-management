import { z } from "@hono/zod-openapi";
import {
  paginationQuerySchema,
  postgresDateSchema,
} from "../../utils/pagination.js";
import { dto } from "./schemas.js";
import { errors, json } from "../booking-requests/http.js";
export const staffPageQuery = paginationQuerySchema.extend({
  search: z
    .string()
    .max(200)
    .default("")
    .transform((value) => value.trim().toLowerCase()),
  filter: z.enum(["all", "open", "responded"]).default("all"),
  date: postgresDateSchema.optional(),
});
export const staffPageResponse = {
  200: {
    content: json(
      z.object({ eventDays: z.array(dto), nextCursor: z.string().nullable() }),
    ),
    description: "Event day page",
  },
  ...errors,
};
