import {
  MAX_EMAIL_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@event-management/contracts/limits/auth";
import { z } from "@hono/zod-openapi";
import { openapiJson } from "../../utils/openapi.js";
import { errorSchema } from "./profile.js";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(MAX_EMAIL_LENGTH);
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, "Use a password with at least 8 characters.")
  .max(MAX_PASSWORD_LENGTH);
export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export const errors = {
  400: {
    content: openapiJson(errorSchema),
    description: "Invalid request",
  },
  401: {
    content: openapiJson(errorSchema),
    description: "Incorrect credentials",
  },
  409: {
    content: openapiJson(errorSchema),
    description: "Account already exists",
  },
  429: {
    content: openapiJson(errorSchema),
    description: "Too many attempts",
  },
};
