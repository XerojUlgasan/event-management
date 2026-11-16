import { env } from "../../utils/env.js";

// Model IDs use the SDK's default Gateway provider and AI_GATEWAY_API_KEY.
export function getTextModel() {
  return env.AI_TEXT.model;
}
