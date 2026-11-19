import { requestHumanHandoffInputSchema } from "@event-management/contracts/ai-handoff";
import { requestHumanHandoffData } from "../../data/messages/request-human-handoff.js";

export function requestHumanHandoffService({
  input,
  ...options
}: Omit<Parameters<typeof requestHumanHandoffData>[0], "handoff"> & {
  input: unknown;
}) {
  const parsed = requestHumanHandoffInputSchema.parse(input);

  return requestHumanHandoffData({
    ...options,
    handoff: { ...parsed, pending: true },
  });
}
