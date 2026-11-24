import { createGateway } from "ai";
import { config } from "../../env.js";

function languageModel({ apiKey, model }: { apiKey: string; model: string }) {
  // Let the SDK resolve model IDs through an explicitly installed provider.
  if (globalThis.AI_SDK_DEFAULT_PROVIDER) return model;

  return createGateway({ apiKey }).languageModel(model);
}

export function getTextModel() {
  return languageModel(config.AI_TEXT);
}

export function getVisionModel() {
  return languageModel(config.AI_VISION);
}
