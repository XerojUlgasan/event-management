import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../../types/hono.js";
import { requireFirebaseAuth, requireSession } from "../../middleware/auth.js";
import { getMeRoute, getMeHandler } from "./get-me.js";
import { logoutRoute, logoutHandler } from "./logout.js";
import { syncProfileRoute, syncProfileHandler } from "./sync-profile.js";

const authRoutes = new OpenAPIHono<HonoEnv>();

authRoutes.use("/auth/sync", requireFirebaseAuth);
authRoutes.use("/me", requireSession);

authRoutes.openapi(syncProfileRoute, syncProfileHandler);
authRoutes.openapi(getMeRoute, getMeHandler);
authRoutes.openapi(logoutRoute, logoutHandler);

export default authRoutes;
