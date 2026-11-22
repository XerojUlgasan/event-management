import { agentSettingsResponseSchema } from "@event-management/contracts/ai-agent-settings";
import { z } from "@hono/zod-openapi";
import { openapiJson } from "../../utils/openapi.js";

export const tags = ["AI agent settings"];

export const errorResponse = (description: string) => ({
  description,
  content: openapiJson(z.object({ error: z.string() })),
});

export const adminErrors = {
  401: errorResponse("Not signed in"),
  403: errorResponse("Admin access required"),
};

export const invalidRequest = errorResponse("Invalid request");

export const readSettings = {
  description: "Published agent settings",
  content: openapiJson(agentSettingsResponseSchema),
};
