import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../../types/hono.js";
import { requireAuth } from "../../middleware/auth.js";
import { getMeRoute, getMeHandler } from "./get-me.js";
import { syncProfileRoute, syncProfileHandler } from "./sync-profile.js";

const authRoutes = new OpenAPIHono<HonoEnv>();

authRoutes.use("/auth/sync", requireAuth);
authRoutes.use("/me", requireAuth);

authRoutes.openapi(syncProfileRoute, syncProfileHandler);
authRoutes.openapi(getMeRoute, getMeHandler);

export default authRoutes;
