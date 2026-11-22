import {
  agentSettingsLimits,
  type AgentPreview,
  type AgentPreviewResponse,
} from "@event-management/contracts/ai-agent-settings";
import { generateText } from "ai";
import { getTextModel } from "../ai/models.js";
import { buildCustomerServicePrompt } from "../ai/prompts/customer-service-prompt.js";

const samplePackages =
  "The sample Garden Celebration package is PHP 45,000 for up to 80 guests. Sample events have no confirmed availability.";
const sampleBusiness =
  "The sample business hours are Monday to Saturday, 9 AM to 5 PM.";

function sampleReply({
  settings,
  messages,
}: AgentPreview): AgentPreviewResponse {
  const latest = messages.at(-1)?.content ?? "";
  const introduction = {
    professional: `Hello, I’m ${settings.displayName}. `,
    friendly: `Hi! I’m ${settings.displayName}. Happy to help! `,
    warm_concise: `Hi, I’m ${settings.displayName}. `,
  }[settings.personality];

  let answer = "What kind of event are you planning?";

  if (/\b(person|staff|human|someone|team|tao)\b/iu.test(latest)) {
    answer = "I would pass your message to the events team for review.";
  } else if (
    /\b(packages?|services?|price|budget|pax|guests?)\b/iu.test(latest)
  ) {
    answer = settings.allowPublicCatalog
      ? samplePackages
      : "You can browse the website’s packages and services or ask the events team for help.";
  } else if (/\b(hours|open|contact|location|phone)\b/iu.test(latest)) {
    answer = settings.allowBusinessInformation
      ? sampleBusiness
      : "You can find contact details and hours in the website footer.";
  }

  return {
    reply: `${messages.length === 1 ? introduction : ""}${answer}`,
    mode: "sample",
  };
}

export async function previewAgentService(
  request: AgentPreview,
  signal: AbortSignal,
): Promise<AgentPreviewResponse | null> {
  let model: ReturnType<typeof getTextModel>;

  try {
    model = getTextModel();
  } catch {
    return sampleReply(request);
  }

  const { settings, messages } = request;
  const sampleContext = [
    "This is an isolated test chat with sample data. Answer as the customer assistant. No tools are available. State what would happen for booking or staff handoff requests without claiming that an action occurred. Use the available sample facts for enabled lookups.",
    settings.allowPublicCatalog ? samplePackages : "",
    settings.allowBusinessInformation ? sampleBusiness : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateText({
      model,
      system: `${sampleContext}\n\n${buildCustomerServicePrompt(settings)}`,
      messages,
      maxOutputTokens: 350,
      maxRetries: 0,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    });
    const reply = text.trim().slice(0, agentSettingsLimits.previewMessage);

    return reply ? { reply, mode: "model" } : null;
  } catch {
    return null;
  }
}
