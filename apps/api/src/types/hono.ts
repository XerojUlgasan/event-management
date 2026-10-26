import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Kysely, Selectable } from "kysely";
import type { DB, Users } from "../db/types.js";

export type Role = "admin" | "customer";

export type FirebaseUser = {
  uid: string;
  email: string;
  name: string | null;
};

export type SessionContext = {
  sessionId: string;
  expiresAt: Date;
  user: Selectable<Users>;
};

export type HonoEnv = {
  Variables: {
    db: Kysely<DB>;
    firebase: FirebaseUser;
    session: SessionContext;
  };
};

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, HonoEnv>;
