import { createGateway } from "ai";
import { config } from "../../env.js";

function gatewaySettings(model: string | undefined, role: string) {
  const apiKey = config.AI_GATEWAY_API_KEY?.trim();
  const modelId = model?.trim();

  if (!apiKey || !modelId)
    throw new Error(`AI ${role} model is not configured`);

  return { apiKey, model: modelId };
}

function languageModel({ apiKey, model }: { apiKey: string; model: string }) {
  // Let the SDK resolve model IDs through an explicitly installed provider.
  if (globalThis.AI_SDK_DEFAULT_PROVIDER) return model;

  return createGateway({ apiKey }).languageModel(model);
}

export function getTextModel() {
  return languageModel(gatewaySettings(config.TEXT_MODEL, "text"));
}

export function getVisionSettings() {
  return gatewaySettings(config.VISION_MODEL, "vision");
}

export function getVisionModel() {
  return languageModel(getVisionSettings());
}

export function getEmbeddingSettings() {
  return gatewaySettings(config.EMBEDDING_MODEL, "embedding");
}
