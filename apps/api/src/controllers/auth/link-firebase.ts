import { MAX_PASSWORD_LENGTH } from "@event-management/contracts/limits/auth";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";
import { linkFirebaseService } from "../../services/auth/link-firebase.js";
import { startSessionService } from "../../services/auth/start-session.js";

export const linkFirebaseRoute = createRoute({
  method: "post",
  path: "/auth/link/firebase",
  tags: ["Auth"],
  summary: "Connect a fresh Firebase identity after proving the local password",
  request: {
    body: {
      required: true,
      content: openapiJson(
        z.object({
          currentPassword: z.string().min(1).max(MAX_PASSWORD_LENGTH),
        }),
      ),
    },
  },
  responses: {
    400: {
      content: openapiJson(errorSchema),
      description: "Invalid request",
    },
    200: {
      content: openapiJson(profileSchema),
      description: "Firebase connected",
    },
    401: {
      content: openapiJson(errorSchema),
      description: "Proof of both accounts required",
    },
    409: {
      content: openapiJson(errorSchema),
      description: "Identity already connected",
    },
    429: {
      content: openapiJson(errorSchema),
      description: "Too many attempts",
    },
    503: {
      content: openapiJson(errorSchema),
      description: "Firebase is not configured",
    },
  },
});

export const linkFirebaseRouteHandler: AppRouteHandler<
  typeof linkFirebaseRoute
> = async (c) => {
  const result = await linkFirebaseService(
    c.get("db"),
    c.get("session"),
    c.get("firebase"),
    c.req.valid("json").currentPassword,
  );
  if (result.kind === "rate-limited")
    return jsonError(c, "Too many attempts. Try again in 15 minutes.", 429);
  if (result.kind === "invalid") {
    return jsonError(
      c,
      "Enter your current password and sign in again with a verified Firebase account.",
      401,
    );
  }

  if (result.kind === "conflict")
    return jsonError(
      c,
      "This Firebase identity or account is already connected. Accounts were not merged.",
      409,
    );
  await startSessionService(c, result.row.id);
  return c.json(toProfile(result.row), 200);
};
