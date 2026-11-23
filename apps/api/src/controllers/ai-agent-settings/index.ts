import { OpenAPIHono } from "@hono/zod-openapi";
import { requireSession, requireSystemAdmin } from "../../middleware/auth.js";
import type { HonoEnv } from "../../types/hono.js";
import {
  getAgentSettingsRoute,
  getAgentSettingsRouteHandler,
} from "./get-agent-settings.js";
import {
  saveAgentSettingsRoute,
  saveAgentSettingsRouteHandler,
} from "./save-agent-settings.js";
import {
  previewAgentRoute,
  previewAgentRouteHandler,
} from "./preview-agent.js";
import {
  getAgentProfileRoute,
  getAgentProfileRouteHandler,
} from "./get-agent-profile.js";

const routes = new OpenAPIHono<HonoEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Check the agent settings and try again." }, 400);
    }
  },
});

const adminPath = "/admin/ai/agent-settings";

routes.use(adminPath, requireSession, requireSystemAdmin);
routes.use(`${adminPath}/*`, requireSession, requireSystemAdmin);
routes.openapi(getAgentSettingsRoute, getAgentSettingsRouteHandler);
routes.openapi(saveAgentSettingsRoute, saveAgentSettingsRouteHandler);
routes.openapi(previewAgentRoute, previewAgentRouteHandler);
routes.openapi(getAgentProfileRoute, getAgentProfileRouteHandler);

export default routes;
