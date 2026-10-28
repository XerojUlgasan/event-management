import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { profileSchema, toProfile } from "./profile.js";
import { emailSchema, newPasswordSchema, errors } from "./http.js";
import { registerUserService } from "../../services/auth/register-user.js";
import { startSessionService } from "../../services/auth/start-session.js";

export const registerUserRoute = createRoute({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Create a local customer account and session",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            email: emailSchema,
            password: newPasswordSchema,
            displayName: z.string().trim().min(1).max(120),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: profileSchema } },
      description: "Account created",
    },
    ...errors,
  },
});

export const registerUserRouteHandler: AppRouteHandler<typeof registerUserRoute> = async (
  c,
) => {
  const { email, password, displayName } = c.req.valid("json");
  const result = await registerUserService(c.get("db"), email, password, displayName);
  if (result.kind === "rate-limited")
    return c.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  if (result.kind === "conflict")
    return c.json(
      {
        error:
          "An account already uses this email. Sign in with its existing method.",
      },
      409,
    );
  await startSessionService(c, result.row.id);
  return c.json(toProfile(result.row), 201);
};
