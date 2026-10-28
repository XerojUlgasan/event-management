import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../../types/hono.js";
import { getHealthRoute, getHealthRouteHandler } from "./get-health.js";

const healthRoutes = new OpenAPIHono<HonoEnv>().openapi(getHealthRoute, getHealthRouteHandler);

export default healthRoutes;
