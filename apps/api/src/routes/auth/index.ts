import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../../types/hono.js";
import { requireFirebaseAuth, requireSession } from "../../middleware/auth.js";
import { getMeRoute, getMeHandler } from "./get-me.js";
import { logoutRoute, logoutHandler } from "./logout.js";
import { syncProfileRoute, syncProfileHandler } from "./sync-profile.js";
import {
  registerRoute,
  registerHandler,
  loginRoute,
  loginHandler,
  addPasswordRoute,
  addPasswordHandler,
} from "./password.js";
import { linkFirebaseRoute, linkFirebaseHandler } from "./link-firebase.js";

const authRoutes = new OpenAPIHono<HonoEnv>();

authRoutes.use("/auth/sync", requireFirebaseAuth);
authRoutes.use("/me", requireSession);
authRoutes.use("/auth/link/firebase", requireSession, requireFirebaseAuth);
authRoutes.use("/auth/password", requireSession, requireFirebaseAuth);

authRoutes.openapi(syncProfileRoute, syncProfileHandler);
authRoutes.openapi(getMeRoute, getMeHandler);
authRoutes.openapi(logoutRoute, logoutHandler);
authRoutes.openapi(registerRoute, registerHandler);
authRoutes.openapi(loginRoute, loginHandler);
authRoutes.openapi(linkFirebaseRoute, linkFirebaseHandler);
authRoutes.openapi(addPasswordRoute, addPasswordHandler);

export default authRoutes;
