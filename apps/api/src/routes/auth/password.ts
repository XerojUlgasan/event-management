import { createRoute, z } from "@hono/zod-openapi";
import { sql } from "kysely";
import type { AppRouteHandler } from "../../types/hono.js";
import { allowAuthAttempt } from "../../lib/auth-limit.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { startSession } from "../../lib/session.js";
import { errorSchema, profileSchema, toProfile } from "./profile.js";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const newPasswordSchema = z
  .string()
  .min(15, "Use a password with at least 15 characters.")
  .max(128);
const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
const errors = {
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

export const registerRoute = createRoute({
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

export const registerHandler: AppRouteHandler<typeof registerRoute> = async (
  c,
) => {
  const { email, password, displayName } = c.req.valid("json");
  if (!allowAuthAttempt(email))
    return c.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  const row = await c
    .get("db")
    .insertInto("users")
    .values({
      email,
      display_name: displayName,
      password_hash: await hashPassword(password),
      role: "customer",
    })
    .onConflict((conflict) => conflict.doNothing())
    .returningAll()
    .executeTakeFirst();
  if (!row)
    return c.json(
      {
        error:
          "An account already uses this email. Sign in with its existing method.",
      },
      409,
    );
  await startSession(c, row.id);
  return c.json(toProfile(row), 201);
};

export const loginRoute = createRoute({
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

export const loginHandler: AppRouteHandler<typeof loginRoute> = async (c) => {
  const { email, password } = c.req.valid("json");
  if (!allowAuthAttempt(email))
    return c.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  const row = await c
    .get("db")
    .selectFrom("users")
    .selectAll()
    .where(sql<string>`lower(trim(email))`, "=", email)
    .executeTakeFirst();
  const valid = await verifyPassword(row?.password_hash ?? null, password);
  if (!row || !valid)
    return c.json({ error: "Incorrect email or password." }, 401);
  await startSession(c, row.id);
  return c.json(toProfile(row), 200);
};

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

export const addPasswordHandler: AppRouteHandler<
  typeof addPasswordRoute
> = async (c) => {
  const { user } = c.get("session");
  const firebase = c.get("firebase");
  if (!allowAuthAttempt(user.id))
    return c.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      429,
    );
  if (
    firebase.uid !== user.firebase_uid ||
    !firebase.emailVerified ||
    firebase.email.trim().toLowerCase() !== user.email.trim().toLowerCase() ||
    !Number.isFinite(firebase.authTime) ||
    Math.abs(Date.now() / 1000 - firebase.authTime) > 300
  ) {
    return c.json(
      {
        error:
          "Sign in again with the connected Firebase account and verify its email before adding a password.",
      },
      401,
    );
  }
  const row = await c
    .get("db")
    .updateTable("users")
    .set({
      password_hash: await hashPassword(c.req.valid("json").password),
      updated_at: new Date(),
    })
    .where("id", "=", user.id)
    .where("password_hash", "is", null)
    .returningAll()
    .executeTakeFirst();
  if (!row)
    return c.json({ error: "This account already has a local password." }, 409);
  await startSession(c, row.id);
  return c.json(toProfile(row), 200);
};
