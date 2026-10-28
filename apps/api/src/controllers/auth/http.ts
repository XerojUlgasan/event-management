import { z } from "@hono/zod-openapi";
import { errorSchema } from "./profile.js";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const newPasswordSchema = z
  .string()
  .min(8, "Use a password with at least 8 characters.")
  .max(128);
export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const errors = {
  400: {
    content: { "application/json": { schema: errorSchema } },
    description: "Invalid request",
  },
  401: {
    content: { "application/json": { schema: errorSchema } },
    description: "Incorrect credentials",
  },
  409: {
    content: { "application/json": { schema: errorSchema } },
    description: "Account already exists",
  },
  429: {
    content: { "application/json": { schema: errorSchema } },
    description: "Too many attempts",
  },
};

