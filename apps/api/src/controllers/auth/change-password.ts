import { createRoute, z } from "@hono/zod-openapi";
import { changePasswordService } from "../../services/auth/change-password.js";
import type { AppRouteHandler } from "../../types/hono.js";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { setSessionCookie } from "../../utils/session.js";
import { currentPasswordSchema, errors, newPasswordSchema } from "./http.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

export const changePasswordRoute = createRoute({
  method: "post",
  path: "/auth/password/change",
  tags: ["Auth"],
  summary: "Change the local password after verifying the current password",
  request: {
    body: {
      required: true,
      content: openapiJson(
        z.object({
          currentPassword: currentPasswordSchema,
          password: newPasswordSchema,
        }),
      ),
    },
  },
  responses: {
    200: {
      content: openapiJson(profileSchema),
      description: "Password changed and current session rotated",
    },
    ...errors,
    401: {
      content: openapiJson(errorSchema),
      description: "A valid session and current password are required",
    },
    409: {
      content: openapiJson(errorSchema),
      description: "No local password or the password changed concurrently",
    },
  },
});

export const changePasswordRouteHandler: AppRouteHandler<
  typeof changePasswordRoute
> = async (c) => {
  const result = await changePasswordService(
    c.get("db"),
    c.get("session"),
    c.req.valid("json"),
  );

  if (result.kind === "rate-limited")
    return jsonError(c, "Too many attempts. Try again in 15 minutes.", 429);

  if (result.kind === "passwordless")
    return jsonError(c, "Add a local password before changing it.", 409);

  if (result.kind === "invalid")
    return jsonError(c, "Incorrect current password.", 401);

  if (result.kind === "session-ended")
    return jsonError(
      c,
      "Your session ended. Sign in again to change your password.",
      401,
    );

  if (result.kind === "conflict")
    return jsonError(
      c,
      "Your password has changed. Enter your current password and try again.",
      409,
    );

  setSessionCookie(c, result.token, result.expiresAt);

  return c.json(toProfile(result.row), 200);
};
