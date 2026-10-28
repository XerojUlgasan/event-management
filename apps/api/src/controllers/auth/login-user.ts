import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { profileSchema, toProfile } from "./profile.js";
import { credentialsSchema, errors } from "./http.js";
import { loginUserService } from "../../services/auth/login-user.js";
import { startSessionService } from "../../services/auth/start-session.js";

export const loginUserRoute = createRoute({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Sign in with a local password",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: credentialsSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: profileSchema } },
      description: "Profile and session cookie",
    },
    ...errors,
  },
});

export const loginUserRouteHandler: AppRouteHandler<typeof loginUserRoute> = async (c) => {
  const { email, password } = c.req.valid("json");
  const result = await loginUserService(c.get("db"), email, password);
  if (result.kind === "rate-limited")
    return c.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  if (result.kind === "invalid")
    return c.json({ error: "Incorrect email or password." }, 401);
  await startSessionService(c, result.row.id);
  return c.json(toProfile(result.row), 200);
};
