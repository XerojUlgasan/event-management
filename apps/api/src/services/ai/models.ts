import { config } from "../../env.js";

// Model IDs use the SDK's default Gateway provider and AI_GATEWAY_API_KEY.
function gatewayModel(name: "TEXT_MODEL" | "VISION_MODEL") {
  if (!config.AI_GATEWAY_API_KEY?.trim())
    throw new Error("AI_GATEWAY_API_KEY is required");

  const model = config[name]?.trim();

  if (!model) throw new Error(`${name} is required`);

  return model;
}

export function getTextModel() {
  return gatewayModel("TEXT_MODEL");
}

export function getVisionModel() {
  return gatewayModel("VISION_MODEL");
}
