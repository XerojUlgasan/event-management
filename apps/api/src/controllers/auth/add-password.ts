import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";
import { newPasswordSchema, errors } from "./http.js";
import { addPasswordService } from "../../services/auth/add-password.js";
import { startSessionService } from "../../services/auth/start-session.js";

export const addPasswordRoute = createRoute({
  method: "post",
  path: "/auth/password",
  tags: ["Auth"],
  summary:
    "Add a local password after freshly authenticating the connected Firebase identity",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({ password: newPasswordSchema }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "Password added",
    },
    ...errors,
    503: {
      content: { "application/json": { schema: errorSchema } },
      description: "Firebase is not configured",
    },
  },
});

export const addPasswordRouteHandler: AppRouteHandler<
  typeof addPasswordRoute
> = async (c) => {
  const firebase = c.get("firebase");
  const result = await addPasswordService(c.get("db"), c.get("session"), firebase, c.req.valid("json").password);
  if (result.kind === "rate-limited")
    return c.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  if (result.kind === "invalid") {
    return c.json(
      {
        error:
          "Sign in again with the connected Firebase account and verify its email before adding a password.",
      },
      401,
    );
  }
  if (result.kind === "conflict")
    return c.json({ error: "This account already has a local password." }, 409);
  await startSessionService(c, result.row.id);
  return c.json(toProfile(result.row), 200);
};
