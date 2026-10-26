import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../db/types.js";

export type Role = "admin" | "customer";

export type AuthUser = {
  uid: string;
  email: string;
  name: string | null;
};

export type HonoEnv = {
  Variables: {
    db: Kysely<DB>;
    auth: AuthUser;
  };
};

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, HonoEnv>;
