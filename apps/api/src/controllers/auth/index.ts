import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoEnv } from "../../types/hono.js";
import { requireFirebaseAuth, requireSession } from "../../middleware/auth.js";
import { getMeRoute, getMeRouteHandler } from "./get-me.js";
import { logoutUserRoute, logoutUserRouteHandler } from "./logout-user.js";
import { syncFirebaseProfileRoute, syncFirebaseProfileRouteHandler } from "./sync-firebase-profile.js";
import { registerUserRoute, registerUserRouteHandler } from "./register-user.js";
import { loginUserRoute, loginUserRouteHandler } from "./login-user.js";
import { addPasswordRoute, addPasswordRouteHandler } from "./add-password.js";
import { linkFirebaseRoute, linkFirebaseRouteHandler } from "./link-firebase.js";

const authRoutes = new OpenAPIHono<HonoEnv>();
authRoutes.use("/auth/sync", requireFirebaseAuth);
authRoutes.use("/me", requireSession);
authRoutes.use("/auth/link/firebase", requireSession, requireFirebaseAuth);
authRoutes.use("/auth/password", requireSession, requireFirebaseAuth);

authRoutes.openapi(syncFirebaseProfileRoute, syncFirebaseProfileRouteHandler);
authRoutes.openapi(getMeRoute, getMeRouteHandler);
authRoutes.openapi(logoutUserRoute, logoutUserRouteHandler);
authRoutes.openapi(registerUserRoute, registerUserRouteHandler);
authRoutes.openapi(loginUserRoute, loginUserRouteHandler);
authRoutes.openapi(linkFirebaseRoute, linkFirebaseRouteHandler);
authRoutes.openapi(addPasswordRoute, addPasswordRouteHandler);
export default authRoutes;
