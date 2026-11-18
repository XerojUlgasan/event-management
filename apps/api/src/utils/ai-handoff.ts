import { aiHandoffSchema } from "@event-management/contracts/ai-handoff";

export function parseAiHandoff(value: unknown) {
  return value === null ? null : aiHandoffSchema.parse(value);
}

export function clearPendingAiHandoff(value: unknown) {
  const handoff = parseAiHandoff(value);
  return handoff ? { ...handoff, pending: false } : null;
}
