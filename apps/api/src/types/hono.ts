import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Kysely } from "kysely";
import type { DB } from "../db/types.js";

export type HonoEnv = {
  Variables: {
    db: Kysely<DB>;
  };
};

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, HonoEnv>;
