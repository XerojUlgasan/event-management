import { MAX_DISPLAY_NAME_LENGTH } from "@event-management/contracts/limits/auth";
import { openapiJson } from "../../utils/openapi.js";
import { jsonError } from "../../utils/service-result.js";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../types/hono.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";
import { syncFirebaseProfileService } from "../../services/auth/sync-firebase-profile.js";
import { startSessionService } from "../../services/auth/start-session.js";

export const syncFirebaseProfileRoute = createRoute({
  method: "post",
  path: "/auth/sync",
  tags: ["Auth"],
  summary:
    "Verify a Firebase identity and start a session without merging accounts by email",
  request: {
    body: {
      content: openapiJson(
        z.object({
          displayName: z
            .string()
            .trim()
            .min(1)
            .max(MAX_DISPLAY_NAME_LENGTH)
            .optional(),
        }),
      ),
      required: true,
    },
  },
  responses: {
    200: {
      content: openapiJson(profileSchema),
      description: "Profile and session cookie",
    },
    400: {
      content: openapiJson(errorSchema),
      description: "Missing email",
    },
    401: {
      content: openapiJson(errorSchema),
      description: "Invalid Firebase identity",
    },
    409: {
      content: openapiJson(errorSchema),
      description: "Email belongs to another account",
    },
    503: {
      content: openapiJson(errorSchema),
      description: "Firebase is not configured",
    },
  },
});

export const syncFirebaseProfileRouteHandler: AppRouteHandler<
  typeof syncFirebaseProfileRoute
> = async (c) => {
  const result = await syncFirebaseProfileService(
    c.get("db"),
    c.get("firebase"),
    c.req.valid("json").displayName,
  );

  if (result.kind === "missing-email") {
    return jsonError(
      c,
      "The signed-in account does not have an email address",
      400,
    );
  }

  if (result.kind === "conflict") {
    return jsonError(
      c,
      "An account already uses this email. Sign in with its existing method, then connect Firebase in Sign-in methods.",
      409,
    );
  }

  // The app profile and role belong to our database, including after linking.
  await startSessionService(c, result.row.id);

  return c.json(toProfile(result.row), 200);
};
